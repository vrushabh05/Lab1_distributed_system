<<<<<<< HEAD
import React, { useEffect, useState } from 'react'
import api from '../api'

=======
import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'

const isPast = (b) => new Date(b.end_date) < new Date()

>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
export default function TravelerBookings() {
  const [items, setItems] = useState([])
  useEffect(() => {
    api.get('/api/bookings/mine').then(r => setItems(r.data.bookings))
  }, [])
<<<<<<< HEAD
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
=======

  const pending = useMemo(()=> items.filter(b=>b.status==='PENDING' && !isPast(b)), [items])
  const upcoming = useMemo(()=> items.filter(b=>b.status==='ACCEPTED' && !isPast(b)), [items])
  const cancelled = useMemo(()=> items.filter(b=>b.status==='CANCELLED'), [items])
  const history = useMemo(()=> items.filter(isPast), [items])

  const Section = ({title,list}) => (
    <div className="bg-white p-3 rounded shadow">
      <h3 className="font-semibold mb-2">{title}</h3>
      <div className="space-y-2">
        {list.map(b=>(
          <div key={b.id} className="flex justify-between border rounded p-2">
            <div>
              <div className="font-medium">{b.title}</div>
              <div className="text-sm">{b.start_date} → {b.end_date} • {b.city}</div>
            </div>
            <div className="text-sm">{b.status} • ${b.total_price}</div>
          </div>
        ))}
        {list.length===0 && <div className="text-sm text-gray-500">Nothing here.</div>}
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      <Section title="Pending" list={pending} />
      <Section title="Upcoming (Accepted)" list={upcoming} />
      <Section title="Cancelled" list={cancelled} />
      <Section title="History (Past trips)" list={history} />
>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
    </div>
  )
}
