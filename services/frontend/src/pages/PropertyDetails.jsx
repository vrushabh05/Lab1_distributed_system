import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchPropertyById } from '../store/slices/propertiesSlice'
import { fetchFavorites, addFavorite, removeFavorite } from '../store/slices/favoritesSlice'
import { useToast } from '../context/ToastContext'
import { 
  MapPin, Users, BedDouble, Bath, Wifi, Tv, Coffee, 
  Wind, Star, Heart, X, ChevronLeft, ChevronRight, Check, Calendar 
} from 'lucide-react'

export default function PropertyDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const toast = useToast()
  const { selectedProperty: p, loading: propertyLoading } = useSelector((state) => state.properties)
  const { items: favorites } = useSelector((state) => state.favorites)
  
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayAfter = new Date(tomorrow)
  dayAfter.setDate(dayAfter.getDate() + 2)
  
  const minDate = today.toISOString().split('T')[0]
  const [start, setStart] = useState(tomorrow.toISOString().split('T')[0])
  const [end, setEnd] = useState(dayAfter.toISOString().split('T')[0])
  const [guests, setGuests] = useState(2)
  const [msg, setMsg] = useState(null)
  const [error, setError] = useState(null)
  const [showGallery, setShowGallery] = useState(false)
  const [currentImage, setCurrentImage] = useState(0)
  const [isBooking, setIsBooking] = useState(false)
  
  // Handle both MongoDB _id and id
  const propertyId = p?._id || p?.id
  const isFav = favorites.some(f => String(f.propertyId || f._id || f.id) === String(propertyId))

  useEffect(() => {
    dispatch(fetchPropertyById(id))
    dispatch(fetchFavorites())
  }, [dispatch, id])

  const fallbackImages = [
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=90',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=90',
    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=90',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=90',
    'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1200&q=90'
  ]

  const photos = Array.isArray(p?.photos) && p.photos.length > 0 ? p.photos : fallbackImages
  const galleryImages = photos.length >= 5 ? photos.slice(0, 5) : [...photos, ...fallbackImages].slice(0, 5)

  const numNights = p ? Math.max(1, Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24))) : 1
  const pricePerNight = p ? (p.price_per_night || p.pricePerNight || 0) : 0
  const subtotal = numNights * pricePerNight
  const serviceFee = Math.round(subtotal * 0.15)
  const totalPrice = subtotal + serviceFee

  const book = async () => {
    setError(null)
    setIsBooking(true)
    
    const today = new Date().toISOString().split('T')[0]
    
    if (start < today) {
      setError('Check-in date must be today or later')
      setIsBooking(false)
      return
    }
    if (end <= start) {
      setError('Check-out date must be after check-in date')
      setIsBooking(false)
      return
    }
    
    // Small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 300))
    
    navigate('/checkout', {
      state: {
        bookingData: {
          startDate: start,
          endDate: end,
          guests: Number(guests) || 1,
          pricePerNight,
          numNights,
          subtotal,
          serviceFee,
          totalPrice
        },
        property: p
      }
    })
    setIsBooking(false)
  }

  const toggleFavorite = async () => {
    setMsg(null)
    setError(null)
    
    if (isFav) {
      const result = await dispatch(removeFavorite(propertyId || id))
      if (removeFavorite.fulfilled.match(result)) {
        toast.success('Removed from favorites')
      } else {
        toast.error('Failed to remove from favorites')
      }
    } else {
      const result = await dispatch(addFavorite(propertyId || id))
      if (addFavorite.fulfilled.match(result)) {
        toast.success('Added to favorites!')
      } else {
        toast.error('Failed to add to favorites')
      }
    }
  }

  if (propertyLoading || !p) {
    return (
      <div className="min-h-screen bg-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="skeleton h-96 rounded-3xl mb-8"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="skeleton h-32 rounded-2xl"></div>
              <div className="skeleton h-64 rounded-2xl"></div>
            </div>
            <div className="skeleton h-96 rounded-2xl"></div>
          </div>
        </div>
      </div>
    )
  }

  const amenityIcons = {
    'WiFi': Wifi,
    'TV': Tv,
    'Coffee': Coffee,
    'AC': Wind,
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="grid grid-cols-4 grid-rows-2 gap-3 h-[600px] rounded-3xl overflow-hidden cursor-pointer" onClick={() => setShowGallery(true)}>
          <div className="col-span-2 row-span-2 relative overflow-hidden group">
            <img src={galleryImages[0]} alt="Property" loading="eager" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
          </div>
          
          {galleryImages.slice(1, 5).map((img, i) => (
            <div key={i} className="relative overflow-hidden group">
              <img src={img} alt={`View ${i + 2}`} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
              {i === 3 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="text-white font-semibold">View All Photos</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {showGallery && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          <button onClick={() => setShowGallery(false)} className="absolute top-6 right-6 text-white p-3 hover:bg-white/10 rounded-full transition z-10">
            <X className="w-6 h-6" />
          </button>
          <button onClick={() => setCurrentImage((currentImage - 1 + photos.length) % photos.length)} className="absolute left-6 text-white p-3 hover:bg-white/10 rounded-full transition z-10">
            <ChevronLeft className="w-8 h-8" />
          </button>
          <img src={photos[currentImage]} alt="Gallery" className="max-w-5xl max-h-[90vh] object-contain" />
          <button onClick={() => setCurrentImage((currentImage + 1) % photos.length)} className="absolute right-6 text-white p-3 hover:bg-white/10 rounded-full transition z-10">
            <ChevronRight className="w-8 h-8" />
          </button>
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-white text-sm">
            {currentImage + 1} / {photos.length}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-12">
        {msg && (
          <div className="mb-6 bg-green-50 border-2 border-green-200 text-green-800 px-6 py-4 rounded-2xl flex items-center gap-3 animate-slide-down">
            <Check className="w-5 h-5" />
            {msg}
          </div>
        )}
        
        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 text-red-800 px-6 py-4 rounded-2xl animate-slide-down">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-8">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h1 className="text-heading text-4xl md:text-5xl font-bold text-[var(--color-ink)] mb-3">
                    {p.title || p.name}
                  </h1>
                  <div className="flex items-center gap-4 text-[var(--color-slate)]">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      <span className="font-medium">
                        {[p.city, p.state, p.country].filter(Boolean).join(', ')}
                      </span>
                    </div>
                    <div className="rating">
                      <Star className="w-5 h-5 fill-current rating-star" />
                      <span>4.9</span>
                      <span className="text-[var(--color-mist)]">(128 reviews)</span>
                    </div>
                  </div>
                </div>
                
                <button onClick={toggleFavorite} className={`wishlist-heart ${isFav ? 'active' : ''}`}>
                  <Heart className={`w-6 h-6 ${isFav ? 'fill-current' : ''}`} />
                </button>
              </div>

              <div className="flex items-center gap-6 py-6 border-y border-[var(--color-cloud)]">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-[var(--color-slate)]" />
                  <span className="font-semibold">{p.max_guests || p.maxGuests || 4} guests</span>
                </div>
                <div className="flex items-center gap-2">
                  <BedDouble className="w-5 h-5 text-[var(--color-slate)]" />
                  <span className="font-semibold">{p.bedrooms || 2} bedrooms</span>
                </div>
                <div className="flex items-center gap-2">
                  <Bath className="w-5 h-5 text-[var(--color-slate)]" />
                  <span className="font-semibold">{p.bathrooms || 2} bathrooms</span>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-heading text-2xl font-bold text-[var(--color-ink)] mb-4">About this space</h2>
              <p className="text-lg text-[var(--color-charcoal)] leading-relaxed">
                {p.description || 'A beautiful and comfortable space perfect for your stay.'}
              </p>
            </div>

            <div>
              <h2 className="text-heading text-2xl font-bold text-[var(--color-ink)] mb-6">What this place offers</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(p.amenities || ['WiFi', 'TV', 'Coffee Maker', 'AC']).map((amenity, idx) => {
                  const IconComponent = amenityIcons[amenity] || Check
                  return (
                    <div key={idx} className="flex items-center gap-3 py-3">
                      <IconComponent className="w-6 h-6 text-[var(--color-primary)]" />
                      <span className="font-medium text-[var(--color-ink)]">{amenity}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3 mb-6">
                <Star className="w-8 h-8 fill-current text-[var(--color-warning)]" />
                <h2 className="text-heading text-2xl font-bold text-[var(--color-ink)]">4.9 · 128 reviews</h2>
              </div>
              
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border-b border-[var(--color-cloud)] pb-6 last:border-0">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-dark)] flex items-center justify-center text-white font-bold">
                        JD
                      </div>
                      <div>
                        <div className="font-semibold text-[var(--color-ink)]">John Doe</div>
                        <div className="text-sm text-[var(--color-slate)]">October 2025</div>
                      </div>
                    </div>
                    <div className="rating mb-2">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-current rating-star inline" />
                      ))}
                    </div>
                    <p className="text-[var(--color-charcoal)]">
                      Amazing property with stunning views! The host was incredibly responsive and helpful.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="booking-card">
              <div className="mb-6">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-bold text-[var(--color-ink)]">${pricePerNight}</span>
                  <span className="text-[var(--color-slate)]">/ night</span>
                </div>
                <div className="rating">
                  <Star className="w-4 h-4 fill-current rating-star" />
                  <span>4.9</span>
                  <span className="text-[var(--color-mist)]">(128 reviews)</span>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="label flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Check-in
                  </label>
                  <input 
                    type="date" 
                    value={start} 
                    onChange={e => setStart(e.target.value)} 
                    min={minDate} 
                    className="input" 
                    required
                  />
                </div>

                <div>
                  <label className="label flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Check-out
                  </label>
                  <input 
                    type="date" 
                    value={end} 
                    onChange={e => setEnd(e.target.value)} 
                    min={start || minDate} 
                    className="input" 
                    required
                  />
                </div>

                <div>
                  <label className="label flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Guests
                  </label>
                  <select value={guests} onChange={e => setGuests(Number(e.target.value))} className="input">
                    {[...Array(p.max_guests || p.maxGuests || 8)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1} guest{i > 0 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3 mb-6 py-6 border-y border-[var(--color-cloud)]">
                <div className="flex justify-between text-[var(--color-charcoal)]">
                  <span>${pricePerNight} × {numNights} night{numNights > 1 ? 's' : ''}</span>
                  <span>${subtotal}</span>
                </div>
                <div className="flex justify-between text-[var(--color-charcoal)]">
                  <span>Service fee</span>
                  <span>${serviceFee}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-[var(--color-ink)] pt-3 border-t border-[var(--color-cloud)]">
                  <span>Total</span>
                  <span>${totalPrice}</span>
                </div>
              </div>

              <button 
                onClick={book} 
                disabled={isBooking}
                className="btn btn-primary w-full btn-lg mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBooking ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  'Reserve'
                )}
              </button>

              <p className="text-xs text-center text-[var(--color-slate)]">You won't be charged yet</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
