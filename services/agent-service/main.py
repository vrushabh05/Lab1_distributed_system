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

app = FastAPI(
    title='AI Concierge Agent',
    on_startup=[db_manager.connect],
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

@app.post('/agent/plan')
def plan(req: AgentRequest, user: Dict[str, Any] = Depends(verify_jwt_token), database = Depends(get_db)):
    """Generate travel plan - requires traveler authentication"""
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
    elif req.booking:
        location = req.booking.get('location', 'San Jose, USA')
        dates = req.booking.get('dates', {})
        start = (dates.get('start', (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')))[:10]
        end = (dates.get('end', (datetime.now() + timedelta(days=3)).strftime('%Y-%m-%d')))[:10]
        guests = int(req.booking.get('guests', 2))
    else:
        raise HTTPException(status_code=400, detail="Either bookingId or booking object is required")

    prefs_str = req.free_text or ''
    diet = str(req.preferences.get('dietary') or '').lower()
    interests = req.preferences.get('interests') or ['museums', 'parks']
    easy_mobility = any(
        key in (req.free_text or '').lower()
        for key in ['wheelchair', 'stroller', 'no hike', 'no long hike']
    )

    if diet: prefs_str += f' Dietary: {diet}.'
    if interests: prefs_str += f' Interests: {", ".join(interests)}.'
    if easy_mobility: prefs_str += ' Accessibility: Wheelchair/stroller friendly, no long hikes.'

    # Use LangChain for itinerary generation
    duration_days = len(date_range(start, end))
    
    if config.USE_OLLAMA:
        itinerary = generate_itinerary(location, start, duration_days, prefs_str)
    else:
        # Fallback if Ollama is disabled via config
        days = date_range(start, end)
        itinerary = [{'day': d, 'morning': [f'Scenic walk in {location.split(",")[0]}'], 'afternoon': [f'Visit {interests[0] if interests else "local attractions"}'], 'evening': [f'Dinner at a recommended spot']} for d in days]

    # Parallel search for tips (could be optimized with LangChain tools later)
    restaurants = tavily_search(f"{diet or 'good'} restaurants in {location}")
    tips = tavily_search(f'best attractions and tips for {location}')

    return {
        'itinerary': itinerary,
        'restaurants': restaurants,
        'tips': tips,
        'meta': {
            'location': location,
            'dates': {'start': start, 'end': end},
            'guests': guests,
            'model_used': config.OLLAMA_MODEL if config.USE_OLLAMA else 'rule-based'
        }
    }

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