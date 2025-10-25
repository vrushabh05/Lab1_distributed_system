import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

export default function Signup({ setMe }) {
  const nav = useNavigate()
  const [role, setRole] = useState('TRAVELER')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const r = await api.post('/api/auth/signup', { role, name, email, password })
      setMe(r.data.user)
      nav('/')
    } catch (e) {
      setError(e?.response?.data?.error || 'Signup failed')
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h1 className="text-xl font-bold mb-4">Signup</h1>
      <form onSubmit={submit} className="space-y-3">
        <select className="border rounded p-2 w-full" value={role} onChange={e=>setRole(e.target.value)}>
          <option value="TRAVELER">Traveler</option>
          <option value="OWNER">Owner</option>
        </select>
        <input className="border rounded p-2 w-full" placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
        <input className="border rounded p-2 w-full" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="border rounded p-2 w-full" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button className="bg-black text-white px-4 py-2 rounded">Create account</button>
      </form>
    </div>
  )
}
