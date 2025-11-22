import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchFavorites, removeFavorite } from '../store/slices/favoritesSlice'
import { Heart, MapPin, Star } from 'lucide-react'

export default function Favorites() {
  const dispatch = useDispatch()
  const { items, loading, error } = useSelector((state) => state.favorites)
  const { isAuthenticated } = useSelector((state) => state.auth)

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchFavorites())
    }
  }, [dispatch, isAuthenticated])

  const remove = async (propertyId) => {
    dispatch(removeFavorite(propertyId))
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--color-pearl)] py-12 px-4 flex items-center justify-center">
        <p className="text-lg text-[var(--color-slate)]">Please sign in to view your favorites.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-pearl)] py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <div className="skeleton h-12 w-64 rounded-xl mb-4"></div>
            <div className="skeleton h-6 w-48 rounded-lg"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton h-96 rounded-3xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-pearl)] py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-3">
            <Heart className="w-10 h-10 text-[var(--color-action)] fill-current" />
            <h1 className="text-heading text-5xl font-bold text-[var(--color-ink)]">
              Wishlists
            </h1>
          </div>
          <p className="text-lg text-[var(--color-slate)]">
            {items.length === 0 
              ? 'Start saving your favorite places to stay' 
              : `${items.length} saved ${items.length === 1 ? 'stay' : 'stays'}`
            }
          </p>
        </div>

        {error && (
          <div className="mb-8 bg-red-50 border-2 border-red-200 text-red-800 px-6 py-4 rounded-2xl">
            {error}
          </div>
        )}

        {items.length === 0 ? (
          <div className="card max-w-2xl mx-auto text-center py-16">
            <div className="w-24 h-24 bg-gradient-to-br from-[var(--color-accent-light)] to-[var(--color-accent)] rounded-full flex items-center justify-center mx-auto mb-6">
              <Heart className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-heading text-3xl font-bold text-[var(--color-ink)] mb-3">
              Your wishlist is empty
            </h2>
            <p className="text-lg text-[var(--color-slate)] mb-8">
              Start exploring and save your favorite stays for later
            </p>
            <Link to="/search" className="btn btn-primary btn-lg inline-flex">
              Explore stays
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {items.map(p => {
              const propertyData = p.property || p
              const propertyId = propertyData?._id || propertyData?.id || p.propertyId
              const cardKey = propertyId || p._id || p.favoriteId
              const title = propertyData?.title || p.title || 'Beautiful Property'
              const location = [propertyData?.city || p.city, propertyData?.state || p.state, propertyData?.country || p.country]
                .filter(Boolean)
                .join(', ')
              const nightlyRate = propertyData?.pricePerNight || propertyData?.price_per_night || p.pricePerNight || p.price_per_night || 0
              const imageSrc = propertyData?.photos?.[0] || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80'

              return (
              <div key={cardKey} className="listing-card group">
                {/* Image */}
                <div className="listing-image">
                  <img 
                    src={imageSrc}
                    alt={title}
                    className="listing-img"
                  />
                  <button
                    onClick={() => propertyId && remove(propertyId)}
                    className="absolute top-4 right-4 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center transition-all shadow-md hover:shadow-lg z-10"
                    title="Remove from wishlist"
                  >
                    <Heart className="w-5 h-5 text-[var(--color-action)] fill-current" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6">
                  <Link to={`/property/${propertyId}`} className="group/link">
                    <h3 className="text-xl font-bold text-[var(--color-ink)] group-hover/link:text-[var(--color-primary)] transition-colors mb-2 line-clamp-2">
                      {title}
                    </h3>
                  </Link>

                  <div className="flex items-center gap-2 text-[var(--color-slate)] mb-3">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">
                      {location || 'Location unavailable'}
                    </span>
                  </div>

                  <div className="rating mb-4">
                    <Star className="w-4 h-4 fill-current rating-star" />
                    <span>4.9</span>
                    <span className="text-[var(--color-mist)]">(128)</span>
                  </div>

                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-2xl font-bold text-[var(--color-ink)]">
                      ${nightlyRate}
                    </span>
                    <span className="text-[var(--color-slate)]">/ night</span>
                  </div>

                  <Link 
                    to={`/property/${propertyId}`}
                    className="btn btn-secondary w-full"
                  >
                    View details
                  </Link>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  )
}
