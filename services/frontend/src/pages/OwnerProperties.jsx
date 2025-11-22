import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { propertyApi } from '../api'

export default function OwnerProperties() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { user } = useSelector(state => state.auth)
  const navigate = useNavigate()

  useEffect(() => {
    // Check if user is an owner
    if (user && user.role !== 'OWNER') {
      navigate('/')
      return
    }

    // MongoDB uses _id, not id
    const userId = user?._id || user?.id
    if (!userId) {
      setError('User not authenticated')
      setLoading(false)
      return
    }

    propertyApi.get(`/api/properties/owner/${userId}`)
      .then(r => {
        setItems(r.data.properties || [])
        setError(null)
      })
      .catch(err => {
        // Don't show error for 404 (no properties) - that's expected for new users
        if (err?.response?.status !== 404) {
          setError(err?.response?.data?.error || 'Failed to load properties')
        }
      })
      .finally(() => setLoading(false))
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <div className="h-10 bg-gray-200 rounded animate-pulse w-48 mb-2" />
            <div className="h-6 bg-gray-200 rounded animate-pulse w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-lg shadow-md animate-pulse h-64" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 md:px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">🏠 My Properties</h1>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-800 font-medium">⚠️ {error}</p>
          </div>
        )}

        {/* Empty State */}
        {items.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-6xl mb-4">🏘️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No properties yet</h2>
            <p className="text-gray-600 mb-6">Start hosting by listing your first property</p>
            <Link to="/owner/new" className="inline-block bg-gradient-to-r from-rose-500 to-pink-500 text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition">
              + List a Property
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map(property => {
              // MongoDB uses _id, not id
              const propertyId = property._id || property.id
              return (
                <Link
                  to={`/property/${propertyId}`}
                  key={propertyId}
                  className="group bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition transform hover:-translate-y-1"
                >
                  {/* Image Placeholder */}
                  <div className="bg-gradient-to-br from-rose-100 to-pink-100 h-40 flex items-center justify-center relative overflow-hidden">
                    <div className="text-4xl">🏠</div>
                    <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition" />
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-rose-600 transition">
                      {property.title || 'Unnamed Property'}
                    </h3>

                    <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
                      <span>📍</span>
                      <span>{[property.city, property.country].filter(Boolean).join(', ') || 'Location TBD'}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                      <div className="bg-gray-50 rounded p-2">
                        <p className="text-gray-600">🛏️ Bedrooms</p>
                        <p className="font-semibold text-gray-900">{property.bedrooms || '—'}</p>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <p className="text-gray-600">🚿 Bathrooms</p>
                        <p className="font-semibold text-gray-900">{property.bathrooms || '—'}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-600">💵 Per Night</p>
                        <p className="text-lg font-bold text-rose-600">${property.pricePerNight || '0'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-600">👥 Max Guests</p>
                        <p className="text-lg font-bold text-gray-900">{property.maxGuests || '0'}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
