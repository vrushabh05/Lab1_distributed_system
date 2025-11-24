import React, { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import api, { agentApi, propertyApi } from '../api'

export default function AgentButton() {
  const [open, setOpen] = useState(false)
  const [latestBooking, setLatestBooking] = useState(null)
  const [input, setInput] = useState('We are a vegan family of 4, no long hikes, two kids.')
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { user } = useSelector(state => state.auth)

  if (!user || user.role !== 'TRAVELER') {
    return null
  }

  // Load latest booking when panel opens
  useEffect(() => {
    if (!open || !user) return
    let mounted = true
    ;(async () => {
      try {
        // traveler bookings (newest first)
        const bRes = await api.get('/api/bookings')
        if (!mounted) return
        const bookings = (bRes.data.bookings || [])
          .sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at))

        // choose the most relevant: ACCEPTED > PENDING > else first
        const accepted = bookings.find(b => b.status === 'ACCEPTED')
        const pending = bookings.find(b => b.status === 'PENDING')
        setLatestBooking(accepted || pending || bookings[0] || null)
      } catch (e) {
        // ignore if not logged in
      }
    })()
    return () => { mounted = false }
  }, [open, user])

  const bookingContext = useMemo(() => {
    if (!latestBooking) return null
    return latestBooking
  }, [latestBooking])

  // Helper to fetch property details for location string
  const getLocationString = async (propertyId) => {
    if (!propertyId) return 'Unknown'
    try {
      const r = await propertyApi.get(`/api/properties/${propertyId}`)
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
    const interestMap = ['museum', 'museums', 'beach', 'parks', 'hike', 'shopping', 'food', 'art', 'history', 'kids']
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
        try {
          // Handle both MongoDB _id and legacy id, and both camelCase and snake_case
          const propertyId = bookingContext.propertyId || bookingContext.property_id
          const bookingId = bookingContext._id || bookingContext.id
          const startDate = bookingContext.startDate || bookingContext.start_date
          const endDate = bookingContext.endDate || bookingContext.end_date
          
          const loc = await getLocationString(propertyId)
          payload = {
            bookingId: bookingId,
            booking: {
              location: loc,
              dates: { start: startDate, end: endDate },
              party_type: 'unknown',
              guests: bookingContext.guests || 2
            },
            preferences: parsePrefsFromFreeText(input),
            free_text: input
          }
        } catch {
          // Fallback if location fetch fails
          const bookingId = bookingContext._id || bookingContext.id
          const startDate = bookingContext.startDate || bookingContext.start_date
          const endDate = bookingContext.endDate || bookingContext.end_date
          
          payload = {
            bookingId: bookingId,
            booking: {
              location: 'San Jose, USA',
              dates: { start: startDate, end: endDate },
              party_type: 'unknown',
              guests: bookingContext.guests || 2
            },
            preferences: parsePrefsFromFreeText(input),
            free_text: input
          }
        }
      } else {
        payload = {
          bookingId: null,
          booking: {
            location: 'San Jose, USA',
            dates: {
              start: new Date().toISOString().slice(0, 10),
              end: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10)
            },
            party_type: 'unknown',
            guests: 2
          },
          preferences: parsePrefsFromFreeText(input),
          free_text: input
        }
      }

      const res = await agentApi.post('/agent/plan', payload)
      
      // CRITICAL FIX: Handle warnings from backend (partial failures)
      if (res.data.warnings && res.data.warnings.length > 0) {
        console.warn('⚠️ AI Agent warnings:', res.data.warnings);
      }
      
      setResponse(res.data)
    } catch (e) {
      // CRITICAL FIX: Enhanced error handling with specific messages
      let errMsg = 'Failed to get plan from agent';
      
      if (e?.code === 'ECONNABORTED') {
        // Timeout error (15 seconds exceeded)
        errMsg = '⏱️ The AI service took too long to respond. The server might be processing a complex request. Please try again in a moment.';
      } else if (e?.response?.status === 500) {
        // Server error - check for detailed error from backend
        const detail = e?.response?.data?.detail;
        if (detail?.error === 'AI generation failed') {
          errMsg = `🤖 ${detail.message || 'AI service is currently unavailable. Please try again later.'}`;
        } else {
          errMsg = '🔴 The AI service encountered an error. Please try again later.';
        }
      } else if (e?.response?.status === 503) {
        // Service unavailable
        errMsg = '⚠️ The AI service is temporarily unavailable. Please try again in a few minutes.';
      } else if (e?.response?.status === 404) {
        // Booking not found
        errMsg = '❌ The booking you selected was not found. Please try with a different booking or create a new one.';
      } else if (e?.response?.data?.error) {
        // Generic backend error message
        errMsg = e.response.data.error;
      } else if (e?.message) {
        // Network or other error
        errMsg = `⚠️ Connection error: ${e.message}`;
      }
      
      console.error('❌ AI Agent error:', e);
      setError(errMsg)
    } finally {
      // CRITICAL FIX: Always stop loading spinner (prevents infinite spinner)
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-6 right-6 rounded-full shadow-xl bg-black text-white px-4 py-3 hover:bg-gray-800 transition-colors z-40"
      >
        AI Concierge
      </button>

      {open && (
        <>
          {/* Mobile overlay backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
            onClick={() => setOpen(false)}
          />
          
          {/* Panel container - responsive width */}
          <div className="fixed bottom-0 right-0 top-0 h-full w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col">
            {/* Header with close button */}
            <div className="flex-shrink-0 border-b px-4 py-3 flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-lg">Trip Concierge</h2>
                <div className="text-xs text-gray-500 truncate">
                  {`Logged in as ${user.name}`}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {latestBooking ? `Using booking #${latestBooking._id || latestBooking.id}` : 'No booking found — using fallback'}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex-shrink-0 text-2xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg p-1 w-10 h-10 flex items-center justify-center transition-colors"
                aria-label="Close"
                title="Close panel"
              >
                ✕
              </button>
            </div>

            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div>
                <label className="text-sm font-medium block mb-2">Tell the agent your needs</label>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  className="w-full border rounded p-2 h-24 text-sm resize-none"
                  placeholder="e.g., vegan, no long hikes, two kids"
                />
              </div>

              <button
                onClick={askAgent}
                disabled={loading}
                className="w-full bg-blue-600 text-white px-3 py-2 rounded disabled:opacity-60 hover:bg-blue-700 transition-colors font-medium"
              >
                {loading ? 'Thinking...' : 'Get Plan'}
              </button>

              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded border border-red-200 text-sm">
                  {error}
                </div>
              )}

              {response && !error && (
                <div className="space-y-4">
                  {/* Show warnings if any service had partial failures */}
                  {response.warnings && response.warnings.length > 0 && (
                    <div className="bg-yellow-50 text-yellow-800 p-3 rounded border border-yellow-200 text-sm">
                      <div className="font-semibold mb-1">⚠️ Partial Results</div>
                      <ul className="list-disc ml-5 text-xs space-y-1">
                        {response.warnings.map((warning, idx) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                      <div className="text-xs mt-2 italic">The AI generated your itinerary, but some recommendations are unavailable.</div>
                    </div>
                  )}
                  
                  {Array.isArray(response.itinerary) && (
                    <section>
                      <h3 className="font-semibold text-sm mb-2">Itinerary</h3>
                      <div className="space-y-2">
                        {response.itinerary.map((day, i) => (
                          <div key={i} className="border rounded p-3 bg-gray-50">
                            <div className="font-medium text-sm">{day.day || day.date}</div>
                            <ul className="list-disc ml-5 text-xs mt-1 space-y-1">
                              {day.morning && (
                                <li><b>Morning:</b> {Array.isArray(day.morning) ? day.morning.join('; ') : day.morning}</li>
                              )}
                              {day.afternoon && (
                                <li><b>Afternoon:</b> {Array.isArray(day.afternoon) ? day.afternoon.join('; ') : day.afternoon}</li>
                              )}
                              {day.evening && (
                                <li><b>Evening:</b> {Array.isArray(day.evening) ? day.evening.join('; ') : day.evening}</li>
                              )}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {Array.isArray(response.activities) && (
                    <section>
                      <h3 className="font-semibold text-sm mb-2">Activities</h3>
                      <div className="space-y-2">
                        {response.activities.map((a, i) => (
                          <div key={i} className="border rounded p-3 bg-gray-50">
                            <div className="font-medium text-sm">{a.title}</div>
                            {(a.address || a.geo) && (
                              <div className="text-xs text-gray-600 mt-1">
                                {a.address} {a.geo ? `(${a.geo.join(',')})` : ''}
                              </div>
                            )}
                            <div className="text-xs text-gray-600 mt-1">Price: {a.priceTier || a.price_tier} • Duration: {a.duration}</div>
                            <div className="text-xs text-gray-600 mt-1">
                              Tags: {(a.tags || []).join(', ')} {a.wheelchair ? '• wheelchair' : ''}{' '}
                              {a.child_friendly || a.childFriendly ? '• child-friendly' : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {Array.isArray(response.restaurants) && (
                    <section>
                      <h3 className="font-semibold text-sm mb-2">Restaurants</h3>
                      <ul className="list-disc ml-5 text-xs space-y-1">
                        {response.restaurants.map((r, i) => (
                          <li key={i}>
                            {typeof r === 'string' ? r : [r.name, r.address].filter(Boolean).join(' — ')}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {Array.isArray(response.packingChecklist || response.checklist) && (
                    <section>
                      <h3 className="font-semibold text-sm mb-2">Packing Checklist</h3>
                      <ul className="list-disc ml-5 text-xs space-y-1">
                        {(response.packingChecklist || response.checklist).map((c, i) => {
                          const text = typeof c === 'string'
                            ? c
                            : [c.item, c.reason].filter(Boolean).join(' — ')
                          return <li key={i}>{text}</li>
                        })}
                      </ul>
                    </section>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
