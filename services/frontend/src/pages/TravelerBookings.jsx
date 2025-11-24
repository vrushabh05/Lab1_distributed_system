import React, { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchBookings } from '../store/slices/bookingsSlice'
import { submitPropertyReview } from '../store/slices/propertiesSlice'
import { Calendar, MapPin, Users, Clock, CheckCircle, XCircle, AlertCircle, Luggage, RefreshCw, Star } from 'lucide-react'
import { DEFAULT_PROPERTY_PLACEHOLDER, getPrimaryPhoto } from '../utils/propertyImages'

const isPast = (b) => new Date(b.end_date || b.endDate) < new Date()

export default function TravelerBookings() {
  const dispatch = useDispatch()
  const { travelerItems, loading, error } = useSelector((state) => state.bookings)
  const { isAuthenticated } = useSelector((state) => state.auth)
  const [activeTab, setActiveTab] = useState('upcoming')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [reviewModalBooking, setReviewModalBooking] = useState(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewError, setReviewError] = useState(null)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewBanner, setReviewBanner] = useState(null)
  const [reviewedIds, setReviewedIds] = useState([])

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchBookings())
    }
  }, [dispatch, isAuthenticated])

  // CRITICAL FIX: Manual refresh to fetch latest booking statuses
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await dispatch(fetchBookings()).unwrap()
    } catch (err) {
      console.error('Failed to refresh bookings:', err)
    } finally {
      // Small delay for visual feedback
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }

  const openReviewModal = (booking) => {
    setReviewModalBooking(booking)
    setReviewRating(5)
    setReviewComment('')
    setReviewError(null)
  }

  const closeReviewModal = () => {
    if (reviewSubmitting) return
    setReviewModalBooking(null)
    setReviewError(null)
  }

  const handleSubmitReview = async () => {
    if (!reviewModalBooking) return
    setReviewSubmitting(true)
    setReviewError(null)
    try {
      await dispatch(
        submitPropertyReview({
          propertyId: reviewModalBooking.propertyId,
          bookingId: reviewModalBooking._id || reviewModalBooking.id,
          rating: reviewRating,
          comment: reviewComment
        })
      ).unwrap()

      setReviewedIds((prev) => {
        const next = new Set(prev)
        next.add(reviewModalBooking._id || reviewModalBooking.id)
        return Array.from(next)
      })
      setReviewBanner('Thanks! Your review has been submitted.')
      closeReviewModal()
    } catch (err) {
      setReviewError(err || 'Failed to submit review')
    } finally {
      setReviewSubmitting(false)
    }
  }

  const pending = useMemo(() => (travelerItems || []).filter(b => b.status === 'PENDING' && !isPast(b)), [travelerItems])
  const upcoming = useMemo(() => (travelerItems || []).filter(b => b.status === 'ACCEPTED' && !isPast(b)), [travelerItems])
  const cancelled = useMemo(() => (travelerItems || []).filter(b => b.status === 'CANCELLED'), [travelerItems])
  const past = useMemo(() => (travelerItems || []).filter(b => b.status === 'ACCEPTED' && isPast(b)), [travelerItems])

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

  const BookingCard = ({ booking, onReview, reviewDisabled }) => {
    const statusConfig = getStatusConfig(booking.status)
    const StatusIcon = statusConfig.icon
    const primaryPhoto = getPrimaryPhoto(booking.property || booking)

    return (
      <div className="card hover:shadow-xl transition-all">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Image */}
          <div className="md:w-48 h-48 bg-gradient-to-br from-[var(--color-accent-light)] to-[var(--color-accent)] rounded-xl overflow-hidden flex-shrink-0">
            <img 
              src={primaryPhoto}
              alt={booking.title || booking.name || 'Property'}
              onError={(e) => {
                e.currentTarget.onerror = null
                e.currentTarget.src = DEFAULT_PROPERTY_PLACEHOLDER
              }}
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
              <div className="flex flex-col sm:flex-row gap-3">
                {onReview && (
                  <button
                    className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => onReview(booking)}
                    disabled={reviewDisabled}
                  >
                    {reviewDisabled ? 'Review submitted' : 'Leave a review'}
                  </button>
                )}
              </div>
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
    <>
    <div className="min-h-screen bg-[var(--color-pearl)] py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header with Refresh Button */}
        <div className="mb-12 flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-heading text-5xl font-bold text-[var(--color-ink)] mb-3">
              My trips
            </h1>
            <p className="text-lg text-[var(--color-slate)]">
              Manage your bookings and travel plans
            </p>
          </div>
          
          {/* CRITICAL FIX: Refresh button for stale data */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || loading}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-[var(--color-ink)] border-2 border-gray-200 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            title="Refresh bookings to see latest status updates"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="font-medium hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-8 bg-red-50 border-2 border-red-200 text-red-800 px-6 py-4 rounded-2xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {reviewBanner && (
          <div className="mb-8 bg-green-50 border-2 border-green-200 text-green-800 px-6 py-4 rounded-2xl flex items-center gap-3">
            <CheckCircle className="w-5 h-5" />
            {reviewBanner}
            <button
              className="ml-auto text-sm underline"
              onClick={() => setReviewBanner(null)}
            >
              Dismiss
            </button>
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
              <BookingCard
                key={booking._id || booking.id}
                booking={booking}
                onReview={activeTab === 'past' && booking.status === 'ACCEPTED' ? openReviewModal : null}
                reviewDisabled={reviewedIds.includes(booking._id || booking.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>

    {reviewModalBooking && (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-bold text-[var(--color-ink)]">Leave a review</h3>
              <p className="text-[var(--color-slate)]">
                Share what you loved about {reviewModalBooking.title || reviewModalBooking.name || 'this stay'}.
              </p>
            </div>
            <button className="text-[var(--color-slate)] hover:text-[var(--color-ink)]" onClick={closeReviewModal}>
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--color-slate)] mb-2">Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setReviewRating(value)}
                  className={`p-3 rounded-xl border transition ${
                    reviewRating >= value
                      ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                      : 'border-[var(--color-cloud)] text-[var(--color-slate)]'
                  }`}
                >
                  <Star className="w-5 h-5" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--color-slate)] mb-2">Comments</label>
            <textarea
              className="w-full border border-[var(--color-cloud)] rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              rows={4}
              placeholder="Let future guests know what to expect..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
            />
          </div>

          {reviewError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {reviewError}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              className="btn btn-secondary"
              onClick={closeReviewModal}
              disabled={reviewSubmitting}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSubmitReview}
              disabled={reviewSubmitting}
            >
              {reviewSubmitting ? 'Submitting...' : 'Submit review'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
