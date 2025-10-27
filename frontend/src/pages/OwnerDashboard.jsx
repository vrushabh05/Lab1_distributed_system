import React, { useEffect, useState } from 'react'
import api from '../api'

export default function OwnerDashboard() {
  const [stats, setStats] = useState(null)
  const [items, setItems] = useState([])

  useEffect(() => {
    api.get('/api/dashboards/owner').then(r => setStats(r.data)).catch(()=>{})
    api.get('/api/bookings/owner').then(r => setItems(r.data.bookings)).catch(()=>{})
  }, [])

<<<<<<< HEAD
=======
  const patchLocal = (id, status) => setItems(prev => prev.map(b => b.id===id ? { ...b, status } : b))

  const act = async (id, action) => {
    try {
      await api.post(`/api/bookings/${id}/${action}`)
      patchLocal(id, action.toUpperCase()==='ACCEPT' ? 'ACCEPTED' : 'CANCELLED')
      // bump stats in-memory
      setStats(s => {
        if (!s) return s
        const out = { ...s }
        if (action==='accept') { out.pending = Math.max(0,(out.pending||1)-1); out.accepted = (out.accepted||0)+1 }
        if (action==='cancel') { out.pending = Math.max(0,(out.pending||1)-1); out.cancelled = (out.cancelled||0)+1 }
        return out
      })
    } catch (_) {}
  }

>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
  return (
    <div className="space-y-3">
      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-bold mb-2">Stats</h2>
        {stats && <div className="flex gap-6">
          <div>Pending: {stats.pending || 0}</div>
          <div>Accepted: {stats.accepted || 0}</div>
          <div>Cancelled: {stats.cancelled || 0}</div>
        </div>}
      </div>
      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-bold mb-2">Recent Requests</h2>
        <div className="space-y-2">
          {items.map(b => (
            <div key={b.id} className="border rounded p-2 flex justify-between items-center">
              <div>
                <div className="font-medium">{b.title}</div>
                <div className="text-sm">{b.start_date} → {b.end_date}</div>
                <div className="text-xs">Guests: {b.guests} • Status: {b.status}</div>
              </div>
              <div className="flex gap-2">
                {b.status === 'PENDING' && <>
<<<<<<< HEAD
                  <button onClick={async()=>{await api.post(`/api/bookings/${b.id}/accept`); location.reload()}} className="bg-green-600 text-white px-3 py-1 rounded">Accept</button>
                  <button onClick={async()=>{await api.post(`/api/bookings/${b.id}/cancel`); location.reload()}} className="bg-red-600 text-white px-3 py-1 rounded">Cancel</button>
=======
                  <button onClick={()=>act(b.id,'accept')} className="bg-green-600 text-white px-3 py-1 rounded">Accept</button>
                  <button onClick={()=>act(b.id,'cancel')} className="bg-red-600 text-white px-3 py-1 rounded">Cancel</button>
>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
                </>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
