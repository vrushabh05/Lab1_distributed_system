import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { fetchOwnerDashboard, updateStats } from '../store/slices/dashboardSlice'
import { fetchOwnerBookings, acceptBooking, rejectBooking } from '../store/slices/bookingsSlice'
import { useToast } from '../context/ToastContext'

const TRAVELER_API_BASE = import.meta.env.VITE_TRAVELER_API_URL || 'http://localhost:3001'

const resolveAvatarUrl = (path) => {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${TRAVELER_API_BASE}${path}`
}

export default function OwnerDashboard() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useSelector((state) => state.auth)
  const { stats, loading: statsLoading, error: statsError } = useSelector((state) => state.dashboard)
  const { ownerItems, loading: bookingsLoading, error: bookingsError } = useSelector((state) => state.bookings)

  const loading = statsLoading || bookingsLoading
  const error = statsError || bookingsError

  useEffect(() => {
    if (!user) {
      return
    }

    if (user.role !== 'OWNER') {
      navigate('/')
      return
    }

    dispatch(fetchOwnerDashboard())
    dispatch(fetchOwnerBookings())
  }, [dispatch, user, navigate])

  const act = async (id, action) => {
    if (action === 'accept') {
      const result = await dispatch(acceptBooking(id))
      if (acceptBooking.fulfilled.match(result)) {
        toast.success('Booking accepted successfully!')
        // Update stats after successful action
        dispatch(updateStats({
          pending: Math.max(0, (stats.pending || 0) - 1),
          accepted: (stats.accepted || 0) + 1,
        }))
        // Refresh bookings to get updated list
        dispatch(fetchOwnerBookings())
      } else {
        // Show error if action failed
        const errorMsg = result.payload || 'Failed to accept booking'
        toast.error(errorMsg)
        console.error('Failed to accept booking:', result.payload)
      }
    } else if (action === 'cancel') {
      const result = await dispatch(rejectBooking(id))
      if (rejectBooking.fulfilled.match(result)) {
        toast.success('Booking declined successfully!')
        // Update stats after successful action
        dispatch(updateStats({
          pending: Math.max(0, (stats.pending || 0) - 1),
          cancelled: (stats.cancelled || 0) + 1,
        }))
        // Refresh bookings to get updated list
        dispatch(fetchOwnerBookings())
      } else {
        // Show error if action failed
        const errorMsg = result.payload || 'Failed to decline booking'
        toast.error(errorMsg)
        console.error('Failed to reject booking:', result.payload)
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6 animate-pulse h-32" />
            <div className="bg-white rounded-lg shadow-md p-6 animate-pulse h-32" />
            <div className="bg-white rounded-lg shadow-md p-6 animate-pulse h-32" />
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 animate-pulse h-64" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 md:px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">📊 Dashboard</h1>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-800 font-medium">⚠️ {error}</p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Pending Card */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-l-4 border-orange-500 rounded-lg shadow-md p-6 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">⏳ Pending</p>
                <p className="text-3xl font-bold text-orange-600">{stats?.pending || 0}</p>
              </div>
              <div className="text-5xl opacity-20">⏱️</div>
            </div>
            <p className="text-xs text-gray-600 mt-3">Awaiting your response</p>
          </div>

          {/* Accepted Card */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-lg shadow-md p-6 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">✅ Accepted</p>
                <p className="text-3xl font-bold text-green-600">{stats?.accepted || 0}</p>
              </div>
              <div className="text-5xl opacity-20">🎉</div>
            </div>
            <p className="text-xs text-gray-600 mt-3">Confirmed bookings</p>
          </div>

          {/* Cancelled Card */}
          <div className="bg-gradient-to-br from-red-50 to-pink-50 border-l-4 border-red-500 rounded-lg shadow-md p-6 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">❌ Cancelled</p>
                <p className="text-3xl font-bold text-red-600">{stats?.cancelled || 0}</p>
              </div>
              <div className="text-5xl opacity-20">🚫</div>
            </div>
            <p className="text-xs text-gray-600 mt-3">Declined bookings</p>
          </div>
        </div>

        {/* Recent Requests Section */}
        <div>
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">📋 Recent Booking Requests</h2>
            <p className="text-gray-600">Review and manage incoming booking requests</p>
          </div>

          {(ownerItems || []).length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">No booking requests yet</h3>
              <p className="text-gray-600 mb-6">When travelers book your properties, they'll appear here</p>
              <a href="/owner/properties" className="inline-block bg-gradient-to-r from-rose-500 to-pink-500 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition">
                View Your Properties
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {(ownerItems || []).map(b => {
                const bookingId = b._id || b.id
                const start = b.startDate || b.start_date
                const end = b.endDate || b.end_date
                const totalPrice = b.totalPrice || b.total_price || 0
                const location = [b.city, b.country].filter(Boolean).join(', ')
                const travelerAvatarUrl = resolveAvatarUrl(b.traveler?.avatar_url || b.traveler?.avatar)
                return (
                  <div key={bookingId} className={`bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition border-l-4 ${b.status === 'PENDING' ? 'border-orange-500' :
                      b.status === 'ACCEPTED' ? 'border-green-500' :
                        'border-red-500'
                    }`}>
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                      {/* Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-gray-900">{b.title || '🏠 Property'}</h3>
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${b.status === 'PENDING' ? 'bg-orange-100 text-orange-800' :
                              b.status === 'ACCEPTED' ? 'bg-green-100 text-green-800' :
                                'bg-red-100 text-red-800'
                            }`}>
                            {b.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                          <div>
                            <p className="text-gray-600">📍 Location</p>
                            <p className="font-semibold text-gray-900">{location || '—'}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">🗓️ Dates</p>
                            <p className="font-semibold text-gray-900">{new Date(start).toLocaleDateString()} → {new Date(end).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">👥 Guests</p>
                            <p className="font-semibold text-gray-900">{b.guests}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">💵 Total</p>
                            <p className="font-semibold text-gray-900">${totalPrice}</p>
                          </div>
                        </div>

                        {/* Guest Details & Comments */}
                        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-semibold text-gray-700 mb-2">👤 Guest Details</p>
                            <div className="flex items-center gap-3">
                              {travelerAvatarUrl ? (
                                <img src={travelerAvatarUrl} alt={b.traveler?.name || 'Guest'} className="w-10 h-10 rounded-full object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xl">👤</div>
                              )}
                              <div>
                                <p className="font-medium text-gray-900">{b.traveler?.name || 'Guest'}</p>
                                <p className="text-xs text-gray-500">{b.traveler?.email || 'No email'}</p>
                                {b.traveler?.phone && <p className="text-xs text-gray-500">{b.traveler.phone}</p>}
                              </div>
                            </div>
                          </div>
                          {b.comments && (
                            <div>
                              <p className="text-sm font-semibold text-gray-700 mb-2">💬 Special Requests</p>
                              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg italic">"{b.comments}"</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      {b.status === 'PENDING' && (
                        <div className="flex gap-3 flex-col sm:flex-row">
                          <button
                            onClick={() => act(bookingId, 'accept')}
                            className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition whitespace-nowrap"
                          >
                            ✅ Accept
                          </button>
                          <button
                            onClick={() => act(bookingId, 'cancel')}
                            className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition whitespace-nowrap"
                          >
                            ❌ Decline
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
