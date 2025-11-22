import React, { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchBookings } from '../store/slices/bookingsSlice'
import { Calendar, MapPin, Users, Clock, CheckCircle, XCircle, AlertCircle, Luggage } from 'lucide-react'

const isPast = (b) => new Date(b.end_date || b.endDate) < new Date()

export default function TravelerBookings() {
  const dispatch = useDispatch()
  const { travelerItems, loading, error } = useSelector((state) => state.bookings)
  const { isAuthenticated } = useSelector((state) => state.auth)
  const [activeTab, setActiveTab] = useState('upcoming')

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchBookings())
    }
  }, [dispatch, isAuthenticated])

  const pending = useMemo(() => travelerItems.filter(b => b.status === 'PENDING' && !isPast(b)), [travelerItems])
  const upcoming = useMemo(() => travelerItems.filter(b => b.status === 'ACCEPTED' && !isPast(b)), [travelerItems])
  const cancelled = useMemo(() => travelerItems.filter(b => b.status === 'CANCELLED'), [travelerItems])
  const past = useMemo(() => travelerItems.filter(b => b.status === 'ACCEPTED' && isPast(b)), [travelerItems])

  const tabs = [
    { id: 'upcoming', label: 'Upcoming', icon: Calendar, count: upcoming.length + pending.length },
    { id: 'past', label: 'Past', icon: Luggage, count: past.length },
    { id: 'cancelled', label: 'Cancelled', icon: XCircle, count: cancelled.length }
  ]

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getStatusConfig = (status) => {
    switch(status) {
      case 'PENDING':
        return {
          icon: Clock,
          color: 'text-orange-600',
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          label: 'Pending'
        }
      case 'ACCEPTED':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bg: 'bg-green-50',
          border: 'border-green-200',
          label: 'Confirmed'
        }
      case 'CANCELLED':
        return {
          icon: XCircle,
          color: 'text-red-600',
          bg: 'bg-red-50',
          border: 'border-red-200',
          label: 'Cancelled'
        }
      default:
        return {
          icon: AlertCircle,
          color: 'text-gray-600',
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          label: status
        }
    }
  }

  const BookingCard = ({ booking }) => {
    const statusConfig = getStatusConfig(booking.status)
    const StatusIcon = statusConfig.icon

    return (
      <div className="card hover:shadow-xl transition-all">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Image */}
          <div className="md:w-48 h-48 bg-gradient-to-br from-[var(--color-accent-light)] to-[var(--color-accent)] rounded-xl overflow-hidden flex-shrink-0">
            <img 
              src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&q=80"
              alt="Property"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold text-[var(--color-ink)] mb-2">
                  {booking.title || booking.name || 'Beautiful Property'}
                </h3>
                <div className="flex items-center gap-2 text-[var(--color-slate)]">
                  <MapPin className="w-4 h-4" />
                  <span>{[booking.city, booking.state, booking.country].filter(Boolean).join(', ') || 'Location unavailable'}</span>
                </div>
              </div>
              <span className={`flex items-center gap-2 px-4 py-2 rounded-full ${statusConfig.bg} ${statusConfig.color} border-2 ${statusConfig.border} font-semibold`}>
                <StatusIcon className="w-4 h-4" />
                {statusConfig.label}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-[var(--color-primary)] mt-0.5" />
                <div>
                  <div className="text-xs text-[var(--color-slate)] mb-1">Check-in</div>
                  <div className="font-semibold text-[var(--color-ink)]">
                    {formatDate(booking.start_date || booking.startDate)}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-[var(--color-primary)] mt-0.5" />
                <div>
                  <div className="text-xs text-[var(--color-slate)] mb-1">Check-out</div>
                  <div className="font-semibold text-[var(--color-ink)]">
                    {formatDate(booking.end_date || booking.endDate)}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-[var(--color-primary)] mt-0.5" />
                <div>
                  <div className="text-xs text-[var(--color-slate)] mb-1">Guests</div>
                  <div className="font-semibold text-[var(--color-ink)]">
                    {booking.guests || 2}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[var(--color-cloud)]">
              <div>
                <div className="text-xs text-[var(--color-slate)] mb-1">Total price</div>
                <div className="text-2xl font-bold text-[var(--color-ink)]">
                  ${booking.total_price || booking.totalPrice || 0}
                </div>
              </div>
              
              {booking.status === 'ACCEPTED' && !isPast(booking) && (
                <button className="btn btn-secondary">
                  View details
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const EmptyState = ({ tab }) => {
    const config = {
      upcoming: {
        icon: Calendar,
        title: 'No upcoming trips',
        description: 'Start planning your next adventure!'
      },
      past: {
        icon: Luggage,
        title: 'No past trips',
        description: 'Your travel history will appear here'
      },
      cancelled: {
        icon: XCircle,
        title: 'No cancelled bookings',
        description: 'Keep exploring amazing stays'
      }
    }

    const { icon: Icon, title, description } = config[tab]

    return (
      <div className="card text-center py-16">
        <div className="w-20 h-20 bg-gradient-to-br from-[var(--color-accent-light)] to-[var(--color-accent)] rounded-full flex items-center justify-center mx-auto mb-6">
          <Icon className="w-10 h-10 text-white" />
        </div>
        <h3 className="text-heading text-2xl font-bold text-[var(--color-ink)] mb-2">
          {title}
        </h3>
        <p className="text-lg text-[var(--color-slate)]">
          {description}
        </p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--color-pearl)] flex items-center justify-center px-4">
        <p className="text-lg text-[var(--color-slate)]">Sign in to view your trips.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-pearl)] py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="skeleton h-14 w-64 rounded-xl mb-8"></div>
          <div className="flex gap-4 mb-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton h-12 w-32 rounded-lg"></div>
            ))}
          </div>
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton h-64 rounded-3xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const getCurrentList = () => {
    switch(activeTab) {
      case 'upcoming':
        return [...pending, ...upcoming]
      case 'past':
        return past
      case 'cancelled':
        return cancelled
      default:
        return []
    }
  }

  const currentList = getCurrentList()

  return (
    <div className="min-h-screen bg-[var(--color-pearl)] py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-heading text-5xl font-bold text-[var(--color-ink)] mb-3">
            My trips
          </h1>
          <p className="text-lg text-[var(--color-slate)]">
            Manage your bookings and travel plans
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-8 bg-red-50 border-2 border-red-200 text-red-800 px-6 py-4 rounded-2xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b-2 border-[var(--color-cloud)]">
          {tabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all relative ${
                  isActive 
                    ? 'text-[var(--color-primary)]' 
                    : 'text-[var(--color-slate)] hover:text-[var(--color-ink)]'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
                {tab.count > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    isActive 
                      ? 'bg-[var(--color-primary)] text-white' 
                      : 'bg-[var(--color-cloud)] text-[var(--color-slate)]'
                  }`}>
                    {tab.count}
                  </span>
                )}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)]"></div>
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {currentList.length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : (
          <div className="space-y-6">
            {currentList.map(booking => (
              <BookingCard key={booking._id || booking.id} booking={booking} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
