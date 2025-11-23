import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { propertyApi } from '../api'
import { deleteProperty } from '../store/slices/propertiesSlice'
import EditPropertyModal from '../components/EditPropertyModal'

export default function OwnerProperties() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { user } = useSelector((state) => state.auth)
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingProperty, setEditingProperty] = useState(null)

  const fetchProperties = async () => {
    if (!user) return
    try {
      setLoading(true)
      // MongoDB uses _id, not id
      const userId = user?._id || user?.id
      if (!userId) {
        setError('User not authenticated')
        setLoading(false)
        return
      }
      const response = await propertyApi.get(`/api/properties/owner/${userId}`)
      setProperties(response.data.properties)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch properties:', err)
      // Don't show error for 404 (no properties) - that's expected for new users
      if (err?.response?.status !== 404) {
        setError(err?.response?.data?.error || 'Failed to load your properties')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && user.role !== 'OWNER') {
      navigate('/')
      return
    }
    fetchProperties()
  }, [user, navigate])

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this property? This action cannot be undone.')) {
      try {
        const result = await dispatch(deleteProperty(id))
        if (deleteProperty.fulfilled.match(result)) {
          // Refresh list
          fetchProperties()
        } else {
          alert('Failed to delete property: ' + (result.payload || 'Unknown error'))
        }
      } catch (err) {
        alert('Error deleting property')
      }
    }
  }

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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">🏠 My Properties</h1>
            <p className="text-gray-600 mt-2">Manage your listed properties</p>
          </div>
          <Link
            to="/owner/new"
            className="bg-gradient-to-r from-rose-500 to-pink-500 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition flex items-center gap-2"
          >
            <span>➕</span> List New Property
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-8">
            {error}
          </div>
        )}

        {properties.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-6xl mb-4">🏘️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No properties listed yet</h2>
            <p className="text-gray-600 mb-6">Start earning by listing your property on Airbnb Clone</p>
            <Link
              to="/owner/new"
              className="inline-block bg-rose-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-rose-600 transition"
            >
              List Your First Property
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {properties.map(property => (
              <div key={property._id || property.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition group">
                {/* Image */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={property.photos?.[0] || 'https://via.placeholder.com/400x300?text=No+Image'}
                    alt={property.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-bold text-gray-900 shadow-sm">
                    ${property.pricePerNight} <span className="font-normal text-gray-600">/ night</span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-gray-900 line-clamp-1">{property.title}</h3>
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <span>⭐</span> 4.8
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{property.description}</p>

                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                    <span className="flex items-center gap-1">🛏️ {property.bedrooms} beds</span>
                    <span className="flex items-center gap-1">👥 {property.maxGuests} guests</span>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-gray-100">
                    <Link
                      to={`/properties/${property._id || property.id}`}
                      className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition text-center"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => setEditingProperty(property)}
                      className="flex-1 bg-blue-50 text-blue-600 py-2 rounded-lg font-medium hover:bg-blue-100 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(property._id || property.id)}
                      className="flex-1 bg-red-50 text-red-600 py-2 rounded-lg font-medium hover:bg-red-100 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit Modal */}
        {editingProperty && (
          <EditPropertyModal
            property={editingProperty}
            onClose={() => {
              setEditingProperty(null)
              fetchProperties() // Refresh after edit
            }}
          />
        )}
      </div>
    </div>
  )
}
