import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { createBooking } from '../store/slices/bookingsSlice'
import { useToast } from '../context/ToastContext'
import {
  Calendar, Users, Home, Check,
  AlertCircle, Star, MapPin, X
} from 'lucide-react'
import { getPrimaryPhoto, DEFAULT_PROPERTY_PLACEHOLDER } from '../utils/propertyImages'

export default function Checkout() {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const toast = useToast()
  const { loading: bookingLoading } = useSelector((state) => state.bookings)
  const { user, isAuthenticated } = useSelector((state) => state.auth)

  // Get booking details from navigation state
  const bookingData = location.state?.bookingData
  const property = location.state?.property

  const [agreed, setAgreed] = useState(false)
  const [specialRequests, setSpecialRequests] = useState('')
  const [bookingConfirmation, setBookingConfirmation] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Redirect if no booking data
    if (!bookingData || !property) {
      navigate('/search')
    }
    if (!isAuthenticated) {
      navigate('/login', { replace: true, state: { from: '/checkout' } })
    }
  }, [bookingData, property, navigate, isAuthenticated])

  if (!bookingData || !property || !isAuthenticated) {
    return null
  }

  const { startDate, endDate, guests, pricePerNight, numNights, subtotal, serviceFee, totalPrice } = bookingData

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const handleConfirmBooking = async () => {
    setError(null)

    const propertyId = property._id || property.id
    const ownerId = property.ownerId || property.owner_id

    if (!propertyId || !ownerId) {
      setError('Unable to identify property owner. Please refresh and try again.')
      return
    }

    if (!agreed) {
      setError('Please agree to the terms and conditions to continue')
      return
    }

    // MOCK PAYMENT - No real card processing
    // In production, integrate with Stripe, PayPal, or similar payment processor
    try {
      const result = await dispatch(createBooking({
        propertyId,
        ownerId,
        startDate,
        endDate,
        totalPrice,
        guests,
        comments: specialRequests
      }))

      if (createBooking.fulfilled.match(result)) {
        setBookingConfirmation(result.payload)
        toast.success('Booking confirmed successfully!')
      } else {
        const errorMsg = result.payload?.error || result.error?.message || 'Booking failed. Please try again.'
        setError(errorMsg)
        toast.error(errorMsg)
      }
    } catch (err) {
      const errorMsg = 'An unexpected error occurred. Please try again.'
      setError(errorMsg)
      toast.error(errorMsg)
    }
  }

  const renderReview = () => (
    <div className="space-y-8">
      <div>
        <h1 className="text-heading text-4xl font-bold text-[var(--color-ink)] mb-3">
          Confirm your stay
        </h1>
        <p className="text-[var(--color-slate)]">
          Review the trip details and lock in your reservation.
        </p>
      </div>

      {/* Trip Summary */}
      <div className="card">
        <div className="flex items-start gap-6">
          <img
            src={getPrimaryPhoto(property)}
            alt={property.title || property.name}
            className="w-32 h-32 rounded-xl object-cover"
            onError={(e) => {
              e.target.src = DEFAULT_PROPERTY_PLACEHOLDER
            }}
          />
          <div className="flex-1">
            <h3 className="text-xl font-bold text-[var(--color-ink)] mb-2">
              {property.title || property.name}
            </h3>
            <div className="flex items-center gap-2 text-[var(--color-slate)] mb-3">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">
                {[property.city, property.state, property.country].filter(Boolean).join(', ')}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-[var(--color-slate)]">
              <span>🛏️ {property.bedrooms || 2} bed{(property.bedrooms || 2) !== 1 ? 's' : ''}</span>
              <span>•</span>
              <span>🚿 {property.bathrooms || 1} bath{(property.bathrooms || 1) !== 1 ? 's' : ''}</span>
              <span>•</span>
              <span>👥 {property.maxGuests || property.max_guests || 4} guests max</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dates & Guests */}
      <div className="card">
        <h3 className="text-xl font-bold text-[var(--color-ink)] mb-6">Your trip</h3>

        <div className="space-y-4">
          <div className="flex justify-between items-center pb-4 border-b border-[var(--color-cloud)] group">
            <div className="flex-1">
              <div className="font-semibold text-[var(--color-ink)] mb-1">Dates</div>
              <div className="text-[var(--color-slate)]">
                {formatDate(startDate)} → {formatDate(endDate)}
              </div>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-sm text-[var(--color-primary)] hover:text-[var(--color-action-dark)] font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Calendar className="w-4 h-4" />
              Edit
            </button>
          </div>

          <div className="flex justify-between items-center group">
            <div className="flex-1">
              <div className="font-semibold text-[var(--color-ink)] mb-1">Guests</div>
              <div className="text-[var(--color-slate)]">{guests} guest{guests > 1 ? 's' : ''}</div>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-sm text-[var(--color-primary)] hover:text-[var(--color-action-dark)] font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Users className="w-4 h-4" />
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* House Rules */}
      <div className="card">
        <h3 className="text-xl font-bold text-[var(--color-ink)] mb-6">House rules</h3>

        <div className="space-y-3 text-[var(--color-charcoal)]">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
              <Check className="w-3 h-3 text-green-600" />
            </div>
            <span>Check-in after 3:00 PM</span>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
              <Check className="w-3 h-3 text-green-600" />
            </div>
            <span>Checkout before 11:00 AM</span>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
              <Check className="w-3 h-3 text-green-600" />
            </div>
            <span>Maximum {property.max_guests || property.maxGuests || 6} guests</span>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
              <X className="w-3 h-3 text-red-600" />
            </div>
            <span>No smoking inside the property</span>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
              <X className="w-3 h-3 text-red-600" />
            </div>
            <span>No parties or events</span>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-[var(--color-cloud)]">
          <label className="label mb-2 block">Special Requests (Optional)</label>
          <textarea
            className="input w-full h-24 resize-none"
            placeholder="Any special requests or comments for the host?"
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
          />
        </div>

        <div className="mt-6 pt-6 border-t border-[var(--color-cloud)]">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-2 border-[var(--color-cloud)] text-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer"
              required
            />
            <span className="text-sm text-[var(--color-charcoal)] group-hover:text-[var(--color-ink)]">
              <span className="text-red-500 font-bold">* </span>
              I agree to the <button type="button" className="underline hover:text-[var(--color-primary)]">house rules</button> and understand the <button type="button" className="underline hover:text-[var(--color-primary)]">cancellation policy</button>
            </span>
          </label>
          {!agreed && (
            <p className="text-xs text-[var(--color-mist)] mt-2 ml-8">
              Required - Please review and accept the terms to continue
            </p>
          )}
        </div>
      </div>

      {!agreed && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 text-sm text-yellow-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <p>Please check the box above to agree to the house rules and cancellation policy before continuing.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-2 border-red-200 text-red-800 px-6 py-4 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

        <button
        onClick={handleConfirmBooking}
        disabled={!agreed || bookingLoading}
        className={`btn w-full btn-lg transition-all duration-200 ${
          agreed && !bookingLoading
            ? 'btn-primary hover:shadow-lg'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
        }`}
        >
        {bookingLoading ? 'Processing...' : 'Confirm booking'}
        </button>
    </div>
  )

  // Step 3: Confirmation
  const renderStep3 = () => (
    <div className="space-y-8 text-center max-w-2xl mx-auto">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-scale-in">
        <Check className="w-10 h-10 text-green-600" />
      </div>

      <div>
        <h1 className="text-heading text-5xl font-bold text-[var(--color-ink)] mb-4">
          Booking confirmed!
        </h1>
        <p className="text-xl text-[var(--color-slate)]">
          Get ready for an amazing stay
        </p>
      </div>

      {bookingConfirmation && (
        <div className="card text-left">
          <div className="text-center mb-6">
            <div className="text-sm text-[var(--color-slate)] mb-1">Booking ID</div>
            <div className="text-2xl font-bold text-[var(--color-primary)]">
              #{bookingConfirmation._id || bookingConfirmation.id || 'CONFIRMED'}
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-[var(--color-cloud)]">
            <div className="flex justify-between">
              <span className="text-[var(--color-slate)]">Status</span>
              <span className="font-semibold text-[var(--color-ink)] capitalize">
                {bookingConfirmation.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-slate)]">Check-in</span>
              <span className="font-semibold text-[var(--color-ink)]">
                {formatDate(startDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-slate)]">Check-out</span>
              <span className="font-semibold text-[var(--color-ink)]">
                {formatDate(endDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-slate)]">Guests</span>
              <span className="font-semibold text-[var(--color-ink)]">
                {guests}
              </span>
            </div>
            <div className="flex justify-between pt-4 border-t border-[var(--color-cloud)]">
              <span className="text-lg font-bold text-[var(--color-ink)]">Total paid (USD)</span>
              <span className="text-lg font-bold text-[var(--color-primary)]">
                ${totalPrice + Math.round(subtotal * 0.10)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-[var(--color-accent-light)] to-[var(--color-accent)] rounded-3xl p-8 text-white">
        <Home className="w-12 h-12 mx-auto mb-4" />
        <h3 className="text-2xl font-bold mb-2">What's next?</h3>
        <p className="mb-6">
          You'll receive a confirmation email shortly. The host will review your booking and respond within 24 hours.
        </p>
        <ul className="text-left space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <Check className="w-5 h-5 mt-0.5" />
            <span>Check your email for booking details</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-5 h-5 mt-0.5" />
            <span>Message your host with any questions</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-5 h-5 mt-0.5" />
            <span>Review check-in instructions before arrival</span>
          </li>
        </ul>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => navigate('/bookings')}
          className="btn btn-secondary flex-1"
        >
          View my trips
        </button>
        <button
          onClick={() => navigate('/search')}
          className="btn btn-primary flex-1"
        >
          Explore more stays
        </button>
      </div>
    </div>
  )

  const taxes = Math.round(subtotal * 0.10)
  const grandTotal = totalPrice + taxes

  return (
    <div className="min-h-screen bg-[var(--color-pearl)] py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {bookingConfirmation ? renderStep3() : renderReview()}
          </div>

          {!bookingConfirmation && (
            <div className="lg:col-span-1">
              <div className="booking-card">
                <h3 className="text-xl font-bold text-[var(--color-ink)] mb-6">
                  Price summary
                </h3>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-[var(--color-charcoal)]">
                    <span className="flex items-center gap-1">
                      ${pricePerNight} × {numNights} night{numNights > 1 ? 's' : ''}
                    </span>
                    <span>${subtotal}</span>
                  </div>
                  <div className="flex justify-between text-[var(--color-charcoal)]">
                    <span className="flex items-center gap-1">
                      Service fee
                      <button
                        className="text-[var(--color-slate)] hover:text-[var(--color-ink)]"
                        title="Platform service fee (15%)"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                      </button>
                    </span>
                    <span>${serviceFee}</span>
                  </div>
                  <div className="flex justify-between text-[var(--color-charcoal)]">
                    <span className="flex items-center gap-1">
                      Taxes & fees
                      <button
                        className="text-[var(--color-slate)] hover:text-[var(--color-ink)]"
                        title="Local occupancy taxes"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                      </button>
                    </span>
                    <span>${taxes}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-[var(--color-ink)] pt-3 border-t border-[var(--color-cloud)]">
                    <span>Total (USD)</span>
                    <span>${grandTotal}</span>
                  </div>
                </div>

                <div className="bg-green-50 rounded-xl p-4 text-sm text-green-800 border border-green-200">
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 text-green-600" />
                    <div>
                      <p className="font-semibold mb-1">Free cancellation</p>
                      <p className="text-green-700">
                        Cancel before {formatDate(new Date(new Date(startDate).getTime() - 2 * 24 * 60 * 60 * 1000).toISOString())} for a full refund
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
