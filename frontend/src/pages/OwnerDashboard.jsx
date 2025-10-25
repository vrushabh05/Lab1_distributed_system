import React, { useEffect, useState } from 'react'
import api from '../api'

export default function OwnerDashboard() {
  const [stats, setStats] = useState(null)
  const [items, setItems] = useState([])

  useEffect(() => {
    api.get('/api/dashboards/owner').then(r => setStats(r.data)).catch(()=>{})
    api.get('/api/bookings/owner').then(r => setItems(r.data.bookings)).catch(()=>{})
  }, [])

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
                  <button onClick={async()=>{await api.post(`/api/bookings/${b.id}/accept`); location.reload()}} className="bg-green-600 text-white px-3 py-1 rounded">Accept</button>
                  <button onClick={async()=>{await api.post(`/api/bookings/${b.id}/cancel`); location.reload()}} className="bg-red-600 text-white px-3 py-1 rounded">Cancel</button>
                </>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
