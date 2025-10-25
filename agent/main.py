# agent/main.py
from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import os
import pymysql
import requests
from datetime import datetime, timedelta

DB = dict(
    host=os.getenv('DB_HOST', 'localhost'),
    port=int(os.getenv('DB_PORT', '3306')),
    user=os.getenv('DB_USER', 'airbnb'),
    password=os.getenv('DB_PASSWORD', 'airbnbpassword'),
    database=os.getenv('DB_NAME', 'airbnb')
)

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")

app = FastAPI(title="AI Concierge Agent")

class Dates(BaseModel):
    start: str
    end: str

class AgentRequest(BaseModel):
    booking_id: Optional[int] = None
    location: Optional[str] = None
    dates: Optional[Dates] = None
    party_type: Optional[str] = "couple"
    preferences: Optional[Dict[str, Any]] = Field(default_factory=dict)
    free_text: Optional[str] = None

def fetch_booking_context(booking_id: int):
    conn = pymysql.connect(**DB, cursorclass=pymysql.cursors.DictCursor)
    try:
        with conn.cursor() as cur:
            cur.execute(
                '''
                SELECT b.*, p.city, p.country, p.title, p.price_per_night
                FROM bookings b
                JOIN properties p ON p.id = b.property_id
                WHERE b.id = %s
                ''',
                (booking_id,)
            )
            return cur.fetchone()
    finally:
        conn.close()

def date_range(start: str, end: str) -> List[str]:
    d0 = datetime.fromisoformat(start)
    d1 = datetime.fromisoformat(end)
    if d1 <= d0:
        return [d0.strftime("%Y-%m-%d")]
    days = []
    d = d0
    while d < d1:
        days.append(d.strftime("%Y-%m-%d"))
        d += timedelta(days=1)
    return days or [d0.strftime("%Y-%m-%d")]

def search_tavily(query: str) -> List[Dict[str, Any]]:
    if not TAVILY_API_KEY:
        return []
    try:
        resp = requests.post(
            "https://api.tavily.com/search",
            headers={"Authorization": f"Bearer {TAVILY_API_KEY}"},
            json={"query": query, "num_results": 5},
            timeout=10
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        results = data.get("results", [])
        # Normalize a minimal shape
        out = []
        for r in results:
            out.append({
                "title": r.get("title") or r.get("url") or "Result",
                "url": r.get("url", ""),
                "snippet": r.get("content") or r.get("snippet") or ""
            })
        return out
    except Exception:
        return []

@app.post("/agent/plan")
def plan(req: AgentRequest):
    # context
    if req.booking_id:
        ctx = fetch_booking_context(req.booking_id)
        if not ctx:
            return {"error": "booking not found"}
        location = f"{ctx.get('city','')}, {ctx.get('country','')}".strip(", ")
        dates = {
            "start": str(ctx["start_date"]),
            "end": str(ctx["end_date"])
        }
        guests = ctx.get("guests", 2)
    else:
        location = (req.location or "San Jose, USA").strip()
        dates = {
            "start": req.dates.start if req.dates else "2025-10-22",
            "end": req.dates.end if req.dates else "2025-10-25"
        }
        guests = int(req.preferences.get("guests", 2))

    dietary = (req.preferences.get("dietary") or "any").lower()
    interests = req.preferences.get("interests", ["museums", "parks"])

    # itinerary
    day_list = date_range(dates["start"], dates["end"])
    plan_blocks = []
    for d in day_list:
        city_name = location.split(",")[0] if "," in location else location
        plan_blocks.append({
            "date": d,
            "morning": f"Easy walk at central park in {city_name}",
            "afternoon": f"Visit a {interests[0]} and grab lunch",
            "evening": f"Dinner at {('a ' + dietary) if dietary!='any' else 'a'} friendly place, sunset viewpoint"
        })

    # web enrichment
    attractions = search_tavily(f"top attractions in {location}")
    restaurants = (
        search_tavily(f"{dietary} restaurants in {location}")
        if dietary != "any" else search_tavily(f"best restaurants in {location}")
    )
    things_to_do = search_tavily(f"things to do in {location} {dates['start']}")

    # static activity fallbacks
    activities = [
        {"title": "City Museum", "address": f"Downtown, {location}", "price_tier": "$$", "duration": "2-3h", "tags": ["museum","indoor","family"]},
        {"title": "Riverfront Park", "address": f"Riverside, {location}", "price_tier": "$", "duration": "2h", "tags": ["park","outdoor","easy"]},
        {"title": "Kids Discovery Center", "address": f"Midtown, {location}", "price_tier": "$$", "duration": "2h", "tags": ["kids","interactive"]}
    ]

    # packing
    checklist = ["ID/Passport", "Comfortable shoes", "Reusable water bottle", "Light jacket"]

    return {
        "location": location,
        "dates": dates,
        "party_type": req.party_type,
        "guests": guests,
        "plan": plan_blocks,
        "activities": activities,
        "restaurants": restaurants[:5] if restaurants else ["Local café", "Popular bistro"],
        "tips": attractions[:5],
        "extra_suggestions": things_to_do[:5],
        "checklist": checklist
    }
