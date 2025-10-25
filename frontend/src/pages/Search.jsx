import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function Search() {
  const [location, setLocation] = useState('San Jose')
  const [start, setStart] = useState('2025-10-22')
  const [end, setEnd] = useState('2025-10-25')
  const [guests, setGuests] = useState(2)
  const [results, setResults] = useState([])

  const go = async () => {
    const r = await api.get('/api/search', { params: { location, start, end, guests } })
    setResults(r.data.results)
  }

  return (
    <div>
      <div className="bg-white p-4 rounded shadow mb-3 grid grid-cols-5 gap-2">
        <input className="border rounded p-2" placeholder="Location" value={location} onChange={e=>setLocation(e.target.value)} />
        <input className="border rounded p-2" type="date" value={start} onChange={e=>setStart(e.target.value)} />
        <input className="border rounded p-2" type="date" value={end} onChange={e=>setEnd(e.target.value)} />
        <input className="border rounded p-2" type="number" value={guests} onChange={e=>setGuests(e.target.value)} />
        <button onClick={go} className="bg-black text-white rounded">Search</button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {results.map(r => (
          <Link to={`/property/${r.id}`} key={r.id} className="bg-white p-3 rounded shadow">
            <div className="font-semibold">{r.title}</div>
            <div className="text-sm">{r.city}, {r.country}</div>
            <div className="text-sm">${r.price_per_night} / night</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
