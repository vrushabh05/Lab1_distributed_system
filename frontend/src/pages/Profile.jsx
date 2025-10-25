import React, { useEffect, useState } from 'react'
import api from '../api'

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [msg, setMsg] = useState(null)
  const [file, setFile] = useState(null)

  useEffect(() => {
    api.get('/api/users/me').then(r => setProfile(r.data.profile)).catch(()=>{})
  }, [])

  const save = async () => {
    const { name, phone, about, city, state, country, languages, gender } = profile
    await api.put('/api/users/me', { name, phone, about, city, state, country, languages, gender })
    setMsg('Saved')
  }

  const upload = async () => {
    const fd = new FormData()
    fd.append('avatar', file)
    const r = await api.post('/api/users/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    setProfile({ ...profile, avatar_url: r.data.avatar_url })
  }

  if (!profile) return <div>Loading...</div>
  return (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded shadow space-y-3">
      <h1 className="text-xl font-bold">My Profile</h1>
      <div className="flex items-center gap-4">
        {profile.avatar_url && <img src={profile.avatar_url} alt="avatar" className="w-16 h-16 rounded-full object-cover" />}
        <input type="file" onChange={e=>setFile(e.target.files[0])} />
        <button onClick={upload} className="bg-gray-800 text-white px-3 py-1 rounded">Upload</button>
      </div>
      <input className="border rounded p-2 w-full" value={profile.name||''} onChange={e=>setProfile({...profile, name:e.target.value})} />
      <div className="grid grid-cols-2 gap-2">
        <input className="border rounded p-2" placeholder="Phone" value={profile.phone||''} onChange={e=>setProfile({...profile, phone:e.target.value})} />
        <input className="border rounded p-2" placeholder="Gender" value={profile.gender||''} onChange={e=>setProfile({...profile, gender:e.target.value})} />
        <input className="border rounded p-2" placeholder="City" value={profile.city||''} onChange={e=>setProfile({...profile, city:e.target.value})} />
        <input className="border rounded p-2" placeholder="State" value={profile.state||''} onChange={e=>setProfile({...profile, state:e.target.value})} />
        <input className="border rounded p-2" placeholder="Country" value={profile.country||''} onChange={e=>setProfile({...profile, country:e.target.value})} />
        <input className="border rounded p-2" placeholder="Languages" value={profile.languages||''} onChange={e=>setProfile({...profile, languages:e.target.value})} />
      </div>
      <textarea className="border rounded p-2 w-full" placeholder="About" value={profile.about||''} onChange={e=>setProfile({...profile, about:e.target.value})}></textarea>
      <button onClick={save} className="bg-black text-white px-4 py-2 rounded">Save</button>
      {msg && <div className="text-green-600">{msg}</div>}
    </div>
  )
}
