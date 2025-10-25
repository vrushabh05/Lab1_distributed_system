import React, { useState } from 'react'
import api from '../api'

export default function NewProperty() {
  const [form, setForm] = useState({
    title:'', type:'Apartment', description:'', address:'', city:'', state:'', country:'USA',
    price_per_night:100, bedrooms:1, bathrooms:1, max_guests:2, amenities:[], photos:[]
  })
  const [msg, setMsg] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    const r = await api.post('/api/properties', form)
    setMsg(`Property created with id ${r.data.id}`)
  }

  const update = (k, v) => setForm(prev => ({...prev, [k]: v}))

  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded shadow space-y-2">
      <h1 className="text-xl font-bold">Post a Property</h1>
      <form onSubmit={submit} className="grid grid-cols-2 gap-2">
        <input className="border rounded p-2 col-span-2" placeholder="Title" value={form.title} onChange={e=>update('title', e.target.value)} />
        <input className="border rounded p-2" placeholder="Type" value={form.type} onChange={e=>update('type', e.target.value)} />
        <input className="border rounded p-2" placeholder="City" value={form.city} onChange={e=>update('city', e.target.value)} />
        <input className="border rounded p-2" placeholder="State" value={form.state} onChange={e=>update('state', e.target.value)} />
        <input className="border rounded p-2" placeholder="Country" value={form.country} onChange={e=>update('country', e.target.value)} />
        <input className="border rounded p-2 col-span-2" placeholder="Address" value={form.address} onChange={e=>update('address', e.target.value)} />
        <textarea className="border rounded p-2 col-span-2" placeholder="Description" value={form.description} onChange={e=>update('description', e.target.value)} />
        <input className="border rounded p-2" type="number" placeholder="Price per night" value={form.price_per_night} onChange={e=>update('price_per_night', Number(e.target.value))} />
        <input className="border rounded p-2" type="number" placeholder="Bedrooms" value={form.bedrooms} onChange={e=>update('bedrooms', Number(e.target.value))} />
        <input className="border rounded p-2" type="number" placeholder="Bathrooms" value={form.bathrooms} onChange={e=>update('bathrooms', Number(e.target.value))} />
        <input className="border rounded p-2" type="number" placeholder="Max guests" value={form.max_guests} onChange={e=>update('max_guests', Number(e.target.value))} />
        <button className="bg-black text-white px-4 py-2 rounded col-span-2">Create</button>
      </form>
      {msg && <div className="text-green-700">{msg}</div>}
    </div>
  )
}
