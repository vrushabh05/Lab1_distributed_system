<<<<<<< HEAD
import React, { useState } from 'react'
import { agentApi } from '../api'

export default function AgentButton() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('We are a vegan family of 4 visiting San Jose for 3 days, no long hikes, two kids.')
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(false)

  const askAgent = async () => {
    setLoading(true)
    setResponse(null)
    try {
      const res = await agentApi.post('/agent/plan', {
        location: 'San Jose, USA',
        dates: { start: '2025-10-22', end: '2025-10-25' },
        party_type: 'family',
        preferences: { budget: 'medium', interests: ['museums','parks'], mobility: 'easy', dietary: 'vegan' },
        free_text: input
      })
      setResponse(res.data)
    } catch (e) {
      setResponse({ error: 'Agent error' })
=======
import React, { useEffect, useMemo, useState } from 'react'
import api, { agentApi } from '../api'

export default function AgentButton() {
  const [open, setOpen] = useState(false)
  const [me, setMe] = useState(null)
  const [latestBooking, setLatestBooking] = useState(null)
  const [input, setInput] = useState('We are a vegan family of 4, no long hikes, two kids.')
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Load user + latest booking when panel opens
  useEffect(() => {
    if (!open) return
    let mounted = true
    ;(async () => {
      try {
        const meRes = await api.get('/api/auth/me')
        if (!mounted) return
        setMe(meRes.data.user || null)

        // traveler bookings (newest first)
        const bRes = await api.get('/api/bookings/mine')
        if (!mounted) return
        const bookings = (bRes.data.bookings || [])
          .sort((a,b)=> new Date(b.created_at) - new Date(a.created_at))

        // choose the most relevant: ACCEPTED > PENDING > else first
        const accepted = bookings.find(b => b.status === 'ACCEPTED')
        const pending = bookings.find(b => b.status === 'PENDING')
        setLatestBooking(accepted || pending || bookings[0] || null)
      } catch (e) {
        // ignore if not logged in
      }
    })()
    return () => { mounted = false }
  }, [open])

  const bookingContext = useMemo(() => {
    if (!latestBooking) return null
    // We’ll ask backend for property details so we get city/country
    return latestBooking
  }, [latestBooking])

  // Helper to fetch property details for location string
  const getLocationString = async (propertyId) => {
    try {
      const r = await api.get(`/api/properties/${propertyId}`)
      const p = r.data.property || r.data
      const parts = [p.city, p.state, p.country].filter(Boolean)
      return parts.join(', ') || 'Unknown'
    } catch {
      return 'Unknown'
    }
  }

  const parsePrefsFromFreeText = (text) => {
    const t = text.toLowerCase()
    const prefs = {
      budget: /budget:\s*(low|medium|high)/.test(t) ? t.match(/budget:\s*(low|medium|high)/)[1] : 'medium',
      interests: [],
      mobility: /wheelchair|stroller|no (long )?hike|easy/.test(t) ? 'easy' : 'normal',
      dietary: /vegan|vegetarian|halal|kosher|gluten[- ]?free/.exec(t)?.[0] || ''
    }
    const interestMap = ['museum','museums','beach','parks','hike','shopping','food','art','history','kids']
    interestMap.forEach(k => { if (t.includes(k)) prefs.interests.push(k) })
    prefs.interests = Array.from(new Set(prefs.interests))
    return prefs
  }

  const askAgent = async () => {
    setLoading(true)
    setError(null)
    setResponse(null)
    try {
      let payload
      if (bookingContext) {
        const loc = await getLocationString(bookingContext.property_id)
        payload = {
          bookingId: bookingContext.id,
          booking: {
            location: loc,
            dates: { start: bookingContext.start_date, end: bookingContext.end_date },
            party_type: 'unknown', // you can store party type on booking if you add a column
            guests: bookingContext.guests
          },
          preferences: parsePrefsFromFreeText(input),
          free_text: input
        }
      } else {
        // fallback (no booking): let user still try the agent
        payload = {
          bookingId: null,
          booking: {
            location: 'San Jose, USA',
            dates: { start: new Date().toISOString().slice(0,10), end: new Date(Date.now()+2*864e5).toISOString().slice(0,10) },
            party_type: 'unknown',
            guests: 2
          },
          preferences: parsePrefsFromFreeText(input),
          free_text: input
        }
      }

      // Matches your existing route prefix '/agent/plan'
      const res = await agentApi.post('/agent/plan', payload)
      setResponse(res.data)
    } catch (e) {
      setError('Agent error')
>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button onClick={() => setOpen(v=>!v)}
        className="fixed bottom-6 right-6 rounded-full shadow-xl bg-black text-white px-4 py-3">
        AI Concierge
      </button>
<<<<<<< HEAD
      {open && (
        <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl p-4 overflow-auto">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-bold">Trip Concierge</h2>
            <button onClick={()=>setOpen(false)}>✕</button>
          </div>
          <textarea value={input} onChange={e=>setInput(e.target.value)}
            className="w-full border rounded p-2 h-24" placeholder="Tell the agent your needs..." />
          <button onClick={askAgent} className="mt-2 bg-blue-600 text-white px-3 py-2 rounded">
            {loading ? 'Thinking...' : 'Get Plan'}
          </button>
          <div className="mt-4 space-y-3">
            {response && !response.error && (
              <>
                <div>
                  <h3 className="font-semibold">Plan</h3>
                  {response.plan?.map((d, i) => (
                    <div key={i} className="border rounded p-2 mb-2">
                      <div className="font-medium">{d.date}</div>
                      <ul className="list-disc ml-5">
                        <li>Morning: {d.morning}</li>
                        <li>Afternoon: {d.afternoon}</li>
                        <li>Evening: {d.evening}</li>
                      </ul>
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className="font-semibold">Activities</h3>
                  {response.activities?.map((a, i) => (
                    <div key={i} className="border rounded p-2 mb-2">
                      <div className="font-medium">{a.title}</div>
                      <div className="text-sm">{a.address}</div>
                      <div className="text-sm">Price: {a.price_tier} • Duration: {a.duration}</div>
                      <div className="text-xs">Tags: {a.tags?.join(', ')}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className="font-semibold">Restaurants</h3>
                  <ul className="list-disc ml-5">
                    {response.restaurants?.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold">Packing Checklist</h3>
                  <ul className="list-disc ml-5">
                    {response.checklist?.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              </>
            )}
            {response?.error && <div className="text-red-600">{response.error}</div>}
          </div>
=======

      {open && (
        <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl p-4 overflow-auto">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h2 className="font-bold">Trip Concierge</h2>
              <div className="text-xs text-gray-500">
                {me ? `Logged in as ${me.name}` : 'Not logged in'}
              </div>
              <div className="text-xs text-gray-500">
                {latestBooking ? `Using booking #${latestBooking.id}` : 'No booking found — using fallback'}
              </div>
            </div>
            <button onClick={()=>setOpen(false)} aria-label="Close">✕</button>
          </div>

          <label className="text-sm font-medium">Tell the agent your needs</label>
          <textarea value={input} onChange={e=>setInput(e.target.value)}
            className="w-full border rounded p-2 h-24" placeholder="e.g., vegan, no long hikes, two kids" />

          <button onClick={askAgent} disabled={loading}
            className="mt-2 bg-blue-600 text-white px-3 py-2 rounded disabled:opacity-60">
            {loading ? 'Thinking...' : 'Get Plan'}
          </button>

          {error && <div className="mt-3 text-red-600">{error}</div>}

          {response && !error && (
            <div className="mt-4 space-y-4">
              {Array.isArray(response.itinerary) && (
                <section>
                  <h3 className="font-semibold">Itinerary</h3>
                  {response.itinerary.map((day, i) => (
                    <div key={i} className="border rounded p-3 mb-2">
                      <div className="font-medium">{day.day || day.date}</div>
                      <ul className="list-disc ml-5 text-sm">
                        {day.morning && <li><b>Morning:</b> {Array.isArray(day.morning) ? day.morning.join('; ') : day.morning}</li>}
                        {day.afternoon && <li><b>Afternoon:</b> {Array.isArray(day.afternoon) ? day.afternoon.join('; ') : day.afternoon}</li>}
                        {day.evening && <li><b>Evening:</b> {Array.isArray(day.evening) ? day.evening.join('; ') : day.evening}</li>}
                      </ul>
                    </div>
                  ))}
                </section>
              )}

              {Array.isArray(response.activities) && (
                <section>
                  <h3 className="font-semibold">Activities</h3>
                  {response.activities.map((a, i) => (
                    <div key={i} className="border rounded p-3 mb-2">
                      <div className="font-medium">{a.title}</div>
                      {(a.address || a.geo) && <div className="text-sm">{a.address} {a.geo ? `(${a.geo.join(',')})` : ''}</div>}
                      <div className="text-xs">Price: {a.priceTier || a.price_tier} • Duration: {a.duration}</div>
                      <div className="text-xs">Tags: {(a.tags||[]).join(', ')} {a.wheelchair ? '• wheelchair' : ''} {a.child_friendly || a.childFriendly ? '• child-friendly' : ''}</div>
                    </div>
                  ))}
                </section>
              )}

              {Array.isArray(response.restaurants) && (
                <section>
                  <h3 className="font-semibold">Restaurants</h3>
                  <ul className="list-disc ml-5 text-sm">
                    {response.restaurants.map((r, i) => (
                      <li key={i}>
                        {typeof r === 'string' ? r :
                          [r.name, r.address].filter(Boolean).join(' — ')}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {Array.isArray(response.packingChecklist || response.checklist) && (
                <section>
                  <h3 className="font-semibold">Packing Checklist</h3>
                  <ul className="list-disc ml-5 text-sm">
                    {(response.packingChecklist || response.checklist).map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </section>
              )}
            </div>
          )}
>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
        </div>
      )}
    </>
  )
}
