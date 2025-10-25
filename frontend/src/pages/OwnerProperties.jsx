import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function OwnerProperties() {
  const [items, setItems] = useState([])
  useEffect(() => {
    api.get('/api/properties/mine').then(r => setItems(r.data.properties))
  }, [])

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map(r => (
        <Link to={`/property/${r.id}`} key={r.id} className="bg-white p-3 rounded shadow">
          <div className="font-semibold">{r.title}</div>
          <div className="text-sm">{r.city}, {r.country}</div>
        </Link>
      ))}
    </div>
  )
}
