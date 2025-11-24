# agent/main.py
from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import requests
import json
import jwt
from datetime import datetime, timedelta
from bson import ObjectId
import re

from core import config, create_logger, create_database_manager
from core.llm import generate_itinerary  # Import LangChain logic

# ============================================================================
# INITIALIZATION
# ============================================================================

logger = create_logger(config.SERVICE_NAME, config.LOG_LEVEL)
db_manager = create_database_manager(config, logger)
db = None  # Will be initialized in startup event

# HTTP Bearer security scheme
security = HTTPBearer(auto_error=False)

# ============================================================================
# STARTUP VALIDATION
# ============================================================================

async def validate_security_config():
    """
    CRITICAL SECURITY: Validate JWT_SECRET at startup (fail-fast)
    Prevents service from starting in an insecure state
    """
    logger.info("Validating security configuration...")
    
    if not config.JWT_SECRET or config.JWT_SECRET.strip() == '':
        logger.error("❌ FATAL: JWT_SECRET is not set or empty")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("🔴 SECURITY ERROR: JWT_SECRET is required")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("")
        print("The agent service requires a JWT_SECRET to verify user tokens.")
        print("Without this secret, the service cannot authenticate users.")
        print("")
        print("Please set the JWT_SECRET environment variable:")
        print("  export JWT_SECRET=\"your-secure-secret-key\"")
        print("")
        print("The secret should match the one used by the auth services.")
        print("")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        raise RuntimeError("JWT_SECRET not configured - cannot start agent service")
    
    if len(config.JWT_SECRET) < 32:
        logger.error(f"❌ FATAL: JWT_SECRET is too weak (length: {len(config.JWT_SECRET)}, minimum: 32)")
        print("🔴 SECURITY ERROR: JWT_SECRET must be at least 32 characters")
        raise RuntimeError("JWT_SECRET too weak - cannot start agent service")
    
    logger.info("✅ Security configuration validated")

app = FastAPI(
    title='AI Concierge Agent',
    on_startup=[validate_security_config, db_manager.connect],
    on_shutdown=[db_manager.disconnect]
)

# ============================================================================
# MIDDLEWARE
# ============================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGIN,
    allow_credentials=True,
    allow_methods=['GET', 'POST'],
    allow_headers=['Content-Type', 'Authorization']
)

@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    correlation_id = logger.generate_correlation_id()
    request.state.logger = logger.child(correlation_id)
    
    start_time = datetime.now()
    response = await call_next(request)
    duration = (datetime.now() - start_time).total_seconds()
    
    request.state.logger.info(f"{request.method} {request.url.path}", extra={
        'statusCode': response.status_code,
        'duration': f"{duration:.3f}s",
        'ip': request.client.host
    })
    return response

# ============================================================================
# DEPENDENCIES & MODELS
# ============================================================================

class AgentRequest(BaseModel):
    bookingId: Optional[str] = None
    booking: Optional[Dict[str, Any]] = None
    preferences: Dict[str, Any] = Field(default_factory=dict)
    free_text: Optional[str] = None

def get_db():
    global db
    if db is None:
        db = db_manager.get_db()
    return db

def verify_jwt_token(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    """Verify JWT token and return decoded payload"""
    if not config.JWT_SECRET:
        logger.error("JWT_SECRET is not configured. Denying all authenticated requests.")
        raise HTTPException(
            status_code=503,
            detail='Authentication system is not configured.'
        )
    
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail='Authorization header missing',
            headers={'WWW-Authenticate': 'Bearer'}
        )
    
    token = credentials.credentials
    
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=['HS256'])
        
        if 'id' not in payload or payload.get('role') != 'TRAVELER':
            raise HTTPException(status_code=403, detail='Invalid token or role')
        
        return payload
    
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token has expired')
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f'Invalid token: {str(e)}')

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def fetch_booking_context(booking_id: str, database):
    """Fetch booking from MongoDB"""
    try:
        obj_id = ObjectId(booking_id)
        booking = database.bookings.find_one({'_id': obj_id})
        if not booking:
            return None
        
        property_id = booking.get('propertyId')
        if property_id:
            prop = database.properties.find_one({'_id': ObjectId(property_id)})
            if prop:
                booking['city'] = prop.get('city')
                booking['country'] = prop.get('country')
                booking['title'] = prop.get('name') or prop.get('title')
        
        return booking
    except Exception as e:
        logger.error(f'Error fetching booking: {e}', extra={'booking_id': booking_id})
        return None

def date_range(start: str, end: str) -> List[str]:
    d0 = datetime.fromisoformat(start)
    d1 = datetime.fromisoformat(end)
    if d0 > d1:
        raise ValueError("Start date must be before or equal to end date")
    days: List[str] = []
    d = d0
    while d <= d1:
        days.append(d.strftime('%Y-%m-%d'))
        d += timedelta(days=1)
    return days or [d0.strftime('%Y-%m-%d')]

def normalize_dietary_filters(pref_value, inferred: Optional[List[str]] = None) -> List[str]:
    values = []
    source = pref_value
    if isinstance(pref_value, str):
        source = [pref_value]
    if isinstance(source, list):
        values.extend(source)
    if inferred:
        values.extend(inferred)
    normalized = []
    for item in values:
        val = str(item).strip().lower()
        if not val:
            continue
        if val in ('gluten free', 'gluten-free'):
            val = 'gluten-free'
        normalized.append(val)
    return list(dict.fromkeys(normalized))

def infer_context_from_free_text(free_text: Optional[str], base_preferences: Dict[str, Any]) -> Dict[str, Any]:
    """Heuristic extraction of booking context from free-form text."""
    if not free_text:
        return {}
    text = free_text.strip()
    lowered = text.lower()
    location = None
    loc_match = re.search(r'in\s+([A-Za-z\s]+?)(?:\s+(?:next|this|for|with)|[,.;])', text)
    if loc_match:
        location = loc_match.group(1).strip()
    if not location:
        fragments = [part.strip() for part in re.split(r',|;|\\band\\b', text) if part.strip()]
        if fragments:
            location = fragments[0]
    today = datetime.now()
    start_date = today + timedelta(days=3)
    if 'next week' in lowered:
        start_date = today + timedelta(days=7)
    elif 'this weekend' in lowered or 'weekend' in lowered:
        days_until_friday = (4 - today.weekday()) % 7
        start_date = today + timedelta(days=days_until_friday)
    elif 'tomorrow' in lowered:
        start_date = today + timedelta(days=1)
    duration = 3
    if 'week' in lowered:
        duration = 7
    pref_dates = base_preferences.get('dates') if isinstance(base_preferences.get('dates'), dict) else {}
    start = pref_dates.get('start') or start_date.strftime('%Y-%m-%d')
    end = pref_dates.get('end') or (start_date + timedelta(days=duration - 1)).strftime('%Y-%m-%d')
    kids = 0
    kids_match = re.search(r'(\d+)\s+(kid|kids|child|children)', lowered)
    if kids_match:
        kids = int(kids_match.group(1))
    elif 'kids' in lowered or 'children' in lowered:
        kids = max(kids, 2)
    party_type = 'family' if kids > 0 or 'family' in lowered else ('friends' if 'friends' in lowered else 'couple')
    interests = base_preferences.get('interests') or []
    interest_keywords = {
        'museum': 'museums',
        'art': 'art',
        'food': 'food',
        'park': 'parks',
        'hike': 'hiking',
        'beach': 'beach',
        'history': 'history',
        'music': 'music'
    }
    for keyword, normalized in interest_keywords.items():
        if keyword in lowered and normalized not in interests:
            interests.append(normalized)
    budget = base_preferences.get('budget')
    if not budget:
        if any(term in lowered for term in ['low budget', 'budget', 'cheap', 'affordable']):
            budget = 'low'
        elif any(term in lowered for term in ['luxury', 'high-end', 'splurge', 'premium']):
            budget = 'high'
        else:
            budget = 'mid'
    dietary = []
    for tag in ['vegan', 'vegetarian', 'gluten-free', 'gluten free', 'halal', 'kosher']:
        if tag in lowered:
            dietary.append('gluten-free' if 'gluten' in tag else tag)
    easy_mobility = any(term in lowered for term in ['wheelchair', 'stroller', 'no long hike', 'no hikes', 'accessible'])
    return {
        'location': location,
        'dates': {'start': start, 'end': end},
        'guests': kids + 2,
        'kids': kids,
        'party_type': party_type,
        'budget': budget,
        'interests': interests,
        'dietary': dietary,
        'easy_mobility': easy_mobility
    }

def price_tier_from_budget(budget: str) -> str:
    mapping = {
        'low': '$',
        'budget': '$',
        'mid': '$$',
        'medium': '$$',
        'standard': '$$',
        'high': '$$$',
        'premium': '$$$'
    }
    return mapping.get((budget or 'mid').lower(), '$$')

def build_activity_card(location: str, interest: str, daypart: str, price_tier: str, accessible: bool, kid_friendly: bool) -> Dict[str, Any]:
    titles = {
        'morning': f"{interest.title()} kick-off",
        'afternoon': f"Deep dive into {interest}",
        'evening': f"{interest.title()} wind-down"
    }
    descriptions = {
        'food': 'Guided tasting of local bites and markets.',
        'museums': 'Curated visits with timed entry to avoid lines.',
        'parks': 'Open-air time with shaded rest areas.',
        'architecture': 'Self-guided walk covering iconic landmarks.',
        'beach': 'Seaside relaxation with accessible boardwalk.',
        'history': 'Story-led walk with expert guide.',
        'music': 'Live performance with reserved seating.',
        'hiking': 'Gentle trail with lookout points.'
    }
    interest_lower = (interest or 'local culture').lower()
    base_description = descriptions.get(interest_lower, 'Immersive local experience tailored by the concierge agent.')
    return {
        'title': titles.get(daypart, f"{interest.title()} experience"),
        'address': f"{location} - {interest.title()} district",
        'coordinates': {'lat': None, 'lng': None},
        'priceTier': price_tier,
        'durationMinutes': 120 if daypart != 'evening' else 150,
        'tags': sorted({interest_lower, daypart, 'local-experience'}),
        'wheelchairFriendly': accessible or interest_lower in ['food', 'museums', 'parks', 'history', 'music'],
        'kidFriendly': kid_friendly or interest_lower in ['parks', 'food', 'music', 'beach'],
        'description': base_description
    }

def build_day_plans(days: List[str], location: str, interests: List[str], budget: str, accessible: bool, kid_friendly: bool) -> List[Dict[str, Any]]:
    interests = interests or ['local culture']
    price_tier = price_tier_from_budget(budget)
    segments = ['morning', 'afternoon', 'evening']
    plans: List[Dict[str, Any]] = []
    for idx, day in enumerate(days):
        interest = interests[idx % len(interests)]
        activities = [
            build_activity_card(location, interest, segments[0], price_tier, accessible, kid_friendly),
            build_activity_card(location, interest, segments[1], price_tier, accessible, kid_friendly),
            build_activity_card(location, interest, segments[2], price_tier, accessible, kid_friendly),
        ]
        plans.append({
            'day': day,
            'theme': interest.title(),
            'summary': f"Focus on {interest} highlights in {location}.",
            'activities': activities
        })
    return plans

def build_restaurant_recommendations(location: str, dietary_filters: List[str], budget: str, accessible: bool, kid_friendly: bool, tavily_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    price_tier = price_tier_from_budget(budget)
    dietary_filters = dietary_filters or ['general']
    recs: List[Dict[str, Any]] = []
    for item in tavily_results[:3]:
        title = item.get('title', 'Local restaurant')
        recs.append({
            'name': title.split('|')[0].strip(),
            'address': location,
            'priceTier': price_tier,
            'dietaryOptions': dietary_filters,
            'tags': ['restaurant', 'local'] + dietary_filters,
            'wheelchairFriendly': accessible,
            'kidFriendly': kid_friendly,
            'sourceUrl': item.get('url'),
            'summary': item.get('snippet', '')
        })
    if not recs:
        sample_name = 'Plant-Based Kitchen' if 'vegan' in dietary_filters else "Chef's Table"
        recs.append({
            'name': sample_name,
            'address': f"{location} city center",
            'priceTier': price_tier,
            'dietaryOptions': dietary_filters,
            'tags': ['restaurant'] + dietary_filters,
            'wheelchairFriendly': accessible,
            'kidFriendly': kid_friendly,
            'sourceUrl': None,
            'summary': 'Curated option that meets the requested dietary filters.'
        })
    return recs

def build_packing_checklist(location: str, start: str, end: str, kid_friendly: bool, accessible: bool, dietary_filters: List[str]) -> List[Dict[str, str]]:
    checklist = [
        {'item': 'Travel documents & insurance', 'reason': 'Required for all international trips.'},
        {'item': 'Comfortable walking shoes', 'reason': f"{location} features cobblestones and hills."},
        {'item': 'Layered outfits', 'reason': 'Mornings and evenings can differ in temperature.'}
    ]
    if accessible:
        checklist.append({'item': 'Lightweight mobility accessories', 'reason': 'Keeps transitions comfortable between activities.'})
    if kid_friendly:
        checklist.append({'item': 'Portable snacks & entertainment', 'reason': 'Keeps younger travelers engaged between stops.'})
        checklist.append({'item': 'Collapsible stroller or carrier', 'reason': 'Helpful for longer walking segments.'})
    if dietary_filters:
        checklist.append({'item': 'Diet-friendly snacks', 'reason': 'Backup in case specialty restaurants are closed.'})
    month = datetime.fromisoformat(start).month if start else datetime.now().month
    if month in (12, 1, 2):
        checklist.append({'item': 'Light rain jacket', 'reason': 'Seasonal showers are common.'})
    else:
        checklist.append({'item': 'Reusable water bottle', 'reason': 'Stay hydrated during outdoor segments.'})
    return checklist

def flatten_activity_cards(day_plans: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [activity for plan in day_plans for activity in plan.get('activities', [])]

def generate_legacy_itinerary(day_plans: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    legacy = []
    for plan in day_plans:
        activities = plan.get('activities', [])
        legacy.append({
            'day': plan.get('day'),
            'morning': [activities[0]['title']] if len(activities) > 0 else [],
            'afternoon': [activities[1]['title']] if len(activities) > 1 else [],
            'evening': [activities[2]['title']] if len(activities) > 2 else []
        })
    return legacy

def tavily_search(query: str) -> List[Dict[str, Any]]:
    if not config.TAVILY_API_KEY:
        return []
    try:
        resp = requests.post(
            'https://api.tavily.com/search',
            json={'api_key': config.TAVILY_API_KEY, 'query': query, 'max_results': 5},
            timeout=config.API_TIMEOUT
        )
        resp.raise_for_status()
        data = resp.json().get('results', [])
        return [{'title': item.get('title', ''), 'url': item.get('url', ''), 'snippet': item.get('content', '')} for item in data]
    except requests.RequestException as e:
        logger.error(f"Tavily search failed: {e}", extra={'query': query})
        return []

# ============================================================================
# ROUTES
# ============================================================================

@app.post('/ai/concierge')
@app.post('/agent/plan')
def plan(req: AgentRequest, user: Dict[str, Any] = Depends(verify_jwt_token), database = Depends(get_db)):
    """Generate travel plan - requires traveler authentication"""
    derived_from_free_text = False
    if req.bookingId:
        ctx = fetch_booking_context(req.bookingId, database)
        if not ctx:
            raise HTTPException(status_code=404, detail="Booking not found")
        location = ', '.join(filter(None, [ctx.get('city'), ctx.get('country')]))
        start_date = ctx.get('startDate')
        end_date = ctx.get('endDate')
        start = str(start_date)[:10] if start_date else (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        end = str(end_date)[:10] if end_date else (datetime.now() + timedelta(days=3)).strftime('%Y-%m-%d')
        guests = int(ctx.get('guests', 2))
        party_type = ctx.get('party', 'couple')
        kids = int(ctx.get('kids', 0))
    elif req.booking:
        location = req.booking.get('location', 'San Jose, USA')
        dates = req.booking.get('dates', {})
        start = (dates.get('start', (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')))[:10]
        end = (dates.get('end', (datetime.now() + timedelta(days=3)).strftime('%Y-%m-%d')))[:10]
        guests = int(req.booking.get('guests', 2))
        party = req.booking.get('party') or {}
        party_type = party.get('type', 'couple')
        kids = int(party.get('kids', 0) or req.booking.get('kids', 0) or 0)
    elif req.free_text:
        derived = infer_context_from_free_text(req.free_text, req.preferences or {})
        if not derived.get('location'):
            raise HTTPException(status_code=400, detail="Unable to infer location from request. Please include city or booking details.")
        location = derived['location']
        start = derived['dates']['start']
        end = derived['dates']['end']
        guests = derived['guests']
        party_type = derived.get('party_type', 'couple')
        kids = derived.get('kids', 0)
        derived_from_free_text = True
        req.preferences = req.preferences or {}
        req.preferences.setdefault('interests', derived.get('interests'))
        req.preferences.setdefault('budget', derived.get('budget'))
        req.preferences.setdefault('dietary', derived.get('dietary'))
        if derived.get('easy_mobility'):
            req.preferences['mobility'] = 'wheelchair'
    else:
        raise HTTPException(status_code=400, detail="Either bookingId or booking object is required")

    prefs_str = req.free_text or ''
    requested_dietary = normalize_dietary_filters(req.preferences.get('dietary'))
    interests = req.preferences.get('interests') or ['museums', 'parks']
    budget = (req.preferences.get('budget') or 'mid').lower()
    mobility_pref = (req.preferences.get('mobility') or '').lower()
    easy_mobility = any(
        key in (req.free_text or '').lower()
        for key in ['wheelchair', 'stroller', 'no hike', 'no long hike']
    ) or 'wheelchair' in mobility_pref or 'accessible' in mobility_pref
    kid_friendly = party_type.lower() == 'family' or kids > 0

    if requested_dietary:
        prefs_str += f' Dietary: {", ".join(requested_dietary)}.'
    if interests: prefs_str += f' Interests: {", ".join(interests)}.'
    if easy_mobility: prefs_str += ' Accessibility: Wheelchair/stroller friendly, no long hikes.'

    # region agent log
    try:
        with open('/home/jey/lab1/.cursor/debug.log', 'a') as _log_file:
            _log_file.write(json.dumps({
                'sessionId': 'debug-session',
                'runId': 'pre-fix',
                'hypothesisId': 'H1',
                'location': 'services/agent-service/main.py:214',
                'message': 'plan request context',
                'data': {
                    'hasBookingId': bool(req.bookingId),
                    'hasBookingObject': bool(req.booking),
                    'derivedFromFreeText': derived_from_free_text,
                    'location': location,
                    'dates': {'start': start, 'end': end},
                    'guests': guests,
                    'partyType': party_type
                },
                'timestamp': int(datetime.utcnow().timestamp() * 1000)
            }) + '\n')
    except Exception:
        pass
    # endregion

    # Use LangChain for itinerary generation
    duration_days = len(date_range(start, end))
    
    # CRITICAL FIX: Validate itinerary generation success
    itinerary = None
    model_used = 'unknown'
    
    if config.USE_OLLAMA:
        try:
            itinerary = generate_itinerary(location, start, duration_days, prefs_str)
            model_used = config.OLLAMA_MODEL
            
            # FIX BUG #11: Check if Ollama returned empty result (silent failure)
            if not itinerary or len(itinerary) == 0:
                logger.error('Ollama returned empty itinerary', extra={
                    'location': location,
                    'duration': duration_days
                })
                # Raise error instead of returning empty response
                raise HTTPException(
                    status_code=500,
                    detail={
                        'error': 'AI generation failed',
                        'message': 'The AI service could not generate an itinerary. Please try again later.',
                        'code': 'OLLAMA_EMPTY_RESPONSE'
                    }
                )
        except HTTPException:
            # Re-raise HTTP exceptions
            raise
        except Exception as e:
            logger.error(f'Ollama generation failed: {e}', extra={'location': location})
            # Raise error instead of falling back silently
            raise HTTPException(
                status_code=500,
                detail={
                    'error': 'AI generation failed',
                    'message': 'The AI service encountered an error. Please try again later.',
                    'code': 'OLLAMA_GENERATION_ERROR',
                    'details': str(e)
                }
            )
    else:
        # Fallback if Ollama is disabled via config
        days = date_range(start, end)
        itinerary = [
            {
                'day': d, 
                'morning': [f'Scenic walk in {location.split(",")[0]}'],
                'afternoon': [f'Visit {interests[0] if interests else "local attractions"}'],
                'evening': [f'Dinner at a recommended spot']
            } for d in days
        ]
        model_used = 'rule-based'

    days = date_range(start, end)
    day_plans = build_day_plans(days, location, interests, budget, easy_mobility, kid_friendly)
    legacy_itinerary = itinerary if itinerary else generate_legacy_itinerary(day_plans)

    # region agent log
    try:
        with open('/home/jey/lab1/.cursor/debug.log', 'a') as _log_file:
            _log_file.write(json.dumps({
                'sessionId': 'debug-session',
                'runId': 'pre-fix',
                'hypothesisId': 'H2',
                'location': 'services/agent-service/main.py:276',
                'message': 'itinerary generation result',
                'data': {
                    'model': model_used,
                    'durationDays': duration_days,
                    'itineraryLength': len(legacy_itinerary or []),
                    'dayPlanCount': len(day_plans),
                    'useOllama': config.USE_OLLAMA
                },
                'timestamp': int(datetime.utcnow().timestamp() * 1000)
            }) + '\n')
    except Exception:
        pass
    # endregion

    # FIX BUG #10: Validate Tavily results and provide warnings
    diet_query = ', '.join(requested_dietary) if requested_dietary else 'good'
    restaurants = tavily_search(f"{diet_query} restaurants in {location}")
    tips = tavily_search(f'best attractions and tips for {location}')
    restaurant_recommendations = build_restaurant_recommendations(
        location,
        requested_dietary,
        budget,
        easy_mobility,
        kid_friendly,
        restaurants
    )
    packing_checklist = build_packing_checklist(location, start, end, kid_friendly, easy_mobility, requested_dietary)
    activity_cards = flatten_activity_cards(day_plans)

    # region agent log
    try:
        with open('/home/jey/lab1/.cursor/debug.log', 'a') as _log_file:
            _log_file.write(json.dumps({
                'sessionId': 'debug-session',
                'runId': 'pre-fix',
                'hypothesisId': 'H3',
                'location': 'services/agent-service/main.py:293',
                'message': 'tavily enrichment summary',
                'data': {
                    'diet': requested_dietary,
                    'restaurantsCount': len(restaurant_recommendations or []),
                    'tipsCount': len(tips or [])
                },
                'timestamp': int(datetime.utcnow().timestamp() * 1000)
            }) + '\n')
    except Exception:
        pass
    # endregion
    
    # Track which services had issues (for user feedback)
    warnings = []
    if not restaurants:
        warnings.append('Restaurant recommendations unavailable')
        logger.warn('Tavily restaurant search returned empty', extra={'location': location})
    
    if not tips:
        warnings.append('Local tips unavailable')
        logger.warn('Tavily tips search returned empty', extra={'location': location})

    # Return successful response with warnings if applicable
    response = {
        'dayPlans': day_plans,
        'activityCards': activity_cards,
        'itinerary': legacy_itinerary,
        'restaurants': restaurant_recommendations,
        'restaurantRecommendations': restaurant_recommendations,
        'packingChecklist': packing_checklist,
        'tips': tips,
        'meta': {
            'location': location,
            'dates': {'start': start, 'end': end},
            'guests': guests,
            'party': {'type': party_type, 'kids': kids},
            'model_used': model_used,
            'nluDerived': derived_from_free_text
        }
    }

    # region agent log
    try:
        with open('/home/jey/lab1/.cursor/debug.log', 'a') as _log_file:
            _log_file.write(json.dumps({
                'sessionId': 'debug-session',
                'runId': 'pre-fix',
                'hypothesisId': 'H4',
                'location': 'services/agent-service/main.py:314',
                'message': 'plan response payload overview',
                'data': {
                    'hasWarnings': bool(warnings),
                    'dayPlanCount': len(day_plans),
                    'activitySample': activity_cards[:1] if activity_cards else [],
                    'restaurantsSample': restaurant_recommendations[:1] if restaurant_recommendations else [],
                    'packingChecklistCount': len(packing_checklist)
                },
                'timestamp': int(datetime.utcnow().timestamp() * 1000)
            }) + '\n')
    except Exception:
        pass
    # endregion
    
    # Add warnings to response if any service failed
    if warnings:
        response['warnings'] = warnings
    
    return response

@app.get('/healthz')
def healthz():
    return {'ok': True}

@app.get('/health')
def health(database = Depends(get_db)):
    """Health check endpoint"""
    db_health = db_manager.health_check()
    if not db_health['ok']:
        raise HTTPException(status_code=503, detail={"service": "agent-service", "mongodb": db_health})
    return {'ok': True, 'service': 'agent-service', 'mongodb': 'connected'}