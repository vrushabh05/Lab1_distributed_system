import React, { useEffect, useState } from 'react'
import api from '../api'

export default function TravelerBookings() {
  const [items, setItems] = useState([])
  useEffect(() => {
    api.get('/api/bookings/mine').then(r => setItems(r.data.bookings))
  }, [])
  return (
    <div className="space-y-2">
      {items.map(b => (
        <div key={b.id} className="bg-white p-3 rounded shadow flex justify-between">
          <div>
            <div className="font-semibold">{b.title}</div>
            <div className="text-sm">{b.start_date} → {b.end_date} • {b.city}</div>
          </div>
          <div className="text-sm">{b.status} • ${b.total_price}</div>
        </div>
      ))}
    </div>
  )
}
