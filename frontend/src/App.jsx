import React, { useEffect, useState } from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import api from './api'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Profile from './pages/Profile'
import Search from './pages/Search'
import PropertyDetails from './pages/PropertyDetails'
import Favorites from './pages/Favorites'
import TravelerBookings from './pages/TravelerBookings'
import OwnerDashboard from './pages/OwnerDashboard'
import OwnerProperties from './pages/OwnerProperties'
import NewProperty from './pages/NewProperty'
import AgentButton from './components/AgentButton'

export default function App() {
  const [me, setMe] = useState(null)
  const nav = useNavigate()

  useEffect(() => {
    api.get('/api/auth/me').then(r => setMe(r.data.user)).catch(()=>{})
  }, [])

  const logout = async () => {
    await api.post('/api/auth/logout')
    setMe(null)
    nav('/login')
  }

  return (
    <div className="min-h-screen">
      <nav className="bg-white shadow p-4 flex gap-4 justify-between">
        <div className="flex gap-4">
          <Link to="/" className="font-semibold">Airbnb Lab</Link>
          <Link to="/search">Search</Link>
          {me?.role === 'TRAVELER' && <Link to="/bookings">My Bookings</Link>}
          {me?.role === 'TRAVELER' && <Link to="/favorites">Favourites</Link>}
          {me?.role === 'OWNER' && <Link to="/owner">Owner Dashboard</Link>}
          {me?.role === 'OWNER' && <Link to="/owner/properties">My Properties</Link>}
          {me?.role === 'OWNER' && <Link to="/owner/new">Post Property</Link>}
        </div>
        <div className="flex gap-3">
          {me ? (
            <>
              <Link to="/profile">{me.name}</Link>
              <button onClick={logout} className="text-red-600">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/signup">Signup</Link>
            </>
          )}
        </div>
      </nav>

      <div className="p-4">
        <Routes>
          <Route path="/" element={<Search />} />
          <Route path="/login" element={<Login setMe={setMe} />} />
          <Route path="/signup" element={<Signup setMe={setMe} />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/search" element={<Search />} />
          <Route path="/property/:id" element={<PropertyDetails />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/bookings" element={<TravelerBookings />} />
          <Route path="/owner" element={<OwnerDashboard />} />
          <Route path="/owner/properties" element={<OwnerProperties />} />
          <Route path="/owner/new" element={<NewProperty />} />
        </Routes>
      </div>

      <AgentButton />
    </div>
  )
}
