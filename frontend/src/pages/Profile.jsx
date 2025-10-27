<<<<<<< HEAD
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
=======
import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'

const COUNTRIES = ["USA","Canada","India","United Kingdom","Germany","France","Australia","Brazil","Japan","Other"];
const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","IA","ID","IL","IN","KS","KY","LA","MA","MD","ME","MI","MN","MO","MS","MT","NC","ND","NE","NH","NJ","NM","NV","NY","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VA","VT","WA","WI","WV","WY"];

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)
  const [file, setFile] = useState(null)

  useEffect(() => {
    api.get('/api/users/me')
      .then(r => setProfile(r.data.profile))
      .catch(()=>setErr("Failed to load profile"))
  }, [])

  const isUSA = useMemo(()=> (profile?.country||"").toUpperCase()==="USA", [profile?.country])

  const save = async () => {
    setErr(null); setMsg(null)
    try {
      const next = { ...profile }
      // enforce state abbreviation when USA
      if (isUSA && next.state) next.state = next.state.toUpperCase().slice(0,2)
      if (isUSA && next.state && !US_STATES.includes(next.state)) {
        setErr("State must be a valid 2-letter abbreviation (e.g., CA).")
        return
      }
      const { name, phone, about, city, state, country, languages, gender } = next
      await api.put('/api/users/me', { name, phone, about, city, state, country, languages, gender })
      setMsg('Saved')
    } catch (e) {
      setErr(e?.response?.data?.error || "Save failed")
    }
  }

  const upload = async () => {
    if (!file) return
    try {
      const fd = new FormData()
      fd.append('avatar', file)
      const r = await api.post('/api/users/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setProfile({ ...profile, avatar_url: r.data.avatar_url })
    } catch (e) {
      setErr(e?.response?.data?.error || "Upload failed")
    }
>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
  }

  if (!profile) return <div>Loading...</div>
  return (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded shadow space-y-3">
      <h1 className="text-xl font-bold">My Profile</h1>
<<<<<<< HEAD
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
=======

      <div className="flex items-center gap-4">
        {profile.avatar_url && <img src={profile.avatar_url} alt="avatar" className="w-16 h-16 rounded-full object-cover" />}
        <input type="file" accept="image/*" onChange={e=>setFile(e.target.files[0])} />
        <button onClick={upload} className="bg-gray-800 text-white px-3 py-1 rounded">Upload</button>
      </div>

      <input className="border rounded p-2 w-full" placeholder="Full name"
             value={profile.name||''} onChange={e=>setProfile({...profile, name:e.target.value})} />

      <div className="grid grid-cols-2 gap-2">
        <input className="border rounded p-2" placeholder="Phone"
               value={profile.phone||''} onChange={e=>setProfile({...profile, phone:e.target.value})} />
        <input className="border rounded p-2" placeholder="Gender"
               value={profile.gender||''} onChange={e=>setProfile({...profile, gender:e.target.value})} />

        <input className="border rounded p-2" placeholder="City"
               value={profile.city||''} onChange={e=>setProfile({...profile, city:e.target.value})} />

        {isUSA ? (
          <select className="border rounded p-2" value={profile.state||''}
                  onChange={e=>setProfile({...profile, state:e.target.value.toUpperCase()})}>
            <option value="">State</option>
            {US_STATES.map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <input className="border rounded p-2" placeholder="State/Region"
                 value={profile.state||''} onChange={e=>setProfile({...profile, state:e.target.value})} />
        )}

        <select className="border rounded p-2" value={profile.country||'USA'}
                onChange={e=>setProfile({...profile, country:e.target.value})}>
          {COUNTRIES.map(c=> <option key={c} value={c}>{c}</option>)}
        </select>

        <input className="border rounded p-2" placeholder="Languages (comma-sep)"
               value={profile.languages||''} onChange={e=>setProfile({...profile, languages:e.target.value})} />
      </div>

      <textarea className="border rounded p-2 w-full" placeholder="About"
                value={profile.about||''} onChange={e=>setProfile({...profile, about:e.target.value})}></textarea>

      <button onClick={save} className="bg-black text-white px-4 py-2 rounded">Save</button>

      {msg && <div className="text-green-600">{msg}</div>}
      {err && <div className="text-red-600">{err}</div>}
>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
    </div>
  )
}
