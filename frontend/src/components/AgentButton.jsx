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
        </div>
      )}
    </>
  )
}
