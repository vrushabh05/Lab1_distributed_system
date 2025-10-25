import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api'

export default function PropertyDetails() {
  const { id } = useParams()
  const [p, setP] = useState(null)
  const [start, setStart] = useState('2025-10-22')
  const [end, setEnd] = useState('2025-10-25')
  const [guests, setGuests] = useState(2)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    api.get(`/api/properties/${id}`).then(r => setP(r.data.property))
  }, [id])

  const book = async () => {
    const r = await api.post('/api/bookings', { property_id: id, start_date: start, end_date: end, guests: Number(guests) })
    setMsg(`Booking created. Status: ${r.data.status}. Total: $${r.data.total_price}`)
  }

  const fav = async () => {
    await api.post(`/api/favorites/${id}`)
    setMsg('Added to favourites')
  }

  if (!p) return <div>Loading...</div>
  return (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded shadow space-y-2">
      <h1 className="text-xl font-bold">{p.title}</h1>
      <div className="text-sm">{p.city}, {p.country} • {p.type} • sleeps {p.max_guests}</div>
      <div className="text-sm">${p.price_per_night} per night</div>
      <p className="text-sm">{p.description}</p>

      <div className="grid grid-cols-4 gap-2 mt-2">
        <input className="border rounded p-2" type="date" value={start} onChange={e=>setStart(e.target.value)} />
        <input className="border rounded p-2" type="date" value={end} onChange={e=>setEnd(e.target.value)} />
        <input className="border rounded p-2" type="number" value={guests} onChange={e=>setGuests(e.target.value)} />
        <button onClick={book} className="bg-blue-600 text-white rounded">Book</button>
      </div>
      <button onClick={fav} className="bg-gray-800 text-white px-3 py-1 rounded">❤ Favourite</button>

      {msg && <div className="text-green-700">{msg}</div>}
    </div>
  )
}
