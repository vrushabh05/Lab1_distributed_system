import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { searchProperties } from '../store/slices/propertiesSlice'
import { fetchFavorites, addFavorite, removeFavorite } from '../store/slices/favoritesSlice'
import { MapPin, SlidersHorizontal, Search as SearchIcon, Heart, X, ChevronDown, Star } from 'lucide-react'

function normalizeDate(d) {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return d
  return date.toISOString().slice(0, 10)
}

export default function Search() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { searchResults, loading, error } = useSelector((state) => state.properties)
  const { items: favoriteItems } = useSelector((state) => state.favorites)
  const { isAuthenticated } = useSelector((state) => state.auth)
  
  const [location, setLocation] = useState(searchParams.get('location') || '')
  const [startDate, setStartDate] = useState(searchParams.get('checkIn') || '')
  const [endDate, setEndDate] = useState(searchParams.get('checkOut') || '')
  const [guests, setGuests] = useState(Number(searchParams.get('guests')) || 2)
  const [validationError, setValidationError] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false)
  const [priceRange, setPriceRange] = useState([0, 1000])
  const [propertyTypes, setPropertyTypes] = useState([])
  const [amenities, setAmenities] = useState([])
  const [sortBy, setSortBy] = useState('recommended') // recommended, price-low, price-high, newest
  
  // Auto-search on mount if params exist
  useEffect(() => {
    if (searchParams.get('location')) {
      onSearchHandler()
    }
  }, [searchParams])

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchFavorites())
    }
  }, [dispatch, isAuthenticated])

  const favoriteIds = useMemo(() => {
    const extractId = (fav) => {
      const prop = fav.property || {}
      return String(prop._id || fav.propertyId || fav._id || fav.id || '')
    }
    return new Set((favoriteItems || []).map(extractId))
  }, [favoriteItems])

  const onSearchHandler = async (useFilters = true) => {
    setValidationError('')
    setIsSearching(true)

    const start = normalizeDate(startDate)
    const end = normalizeDate(endDate)

    // Validate dates if provided
    if (start || end) {
      const today = new Date().toISOString().split('T')[0]
      
      if (start && start < today) {
        setValidationError('Check-in date must be today or later')
        setIsSearching(false)
        return
      }
      
      if (start && end && end <= start) {
        setValidationError('Check-out date must be after check-in date')
        setIsSearching(false)
        return
      }
    }

    const searchCriteria = {
      city: location,
      startDate: start || undefined,
      endDate: end || undefined,
      guests: guests || undefined,
    };

    if (useFilters) {
      if (priceRange[0] > 0) searchCriteria.minPrice = priceRange[0];
      if (priceRange[1] < 1000) searchCriteria.maxPrice = priceRange[1];
      if (propertyTypes.length > 0) searchCriteria.types = propertyTypes.join(',');
    }

    try {
      await dispatch(searchProperties(searchCriteria))
    } catch (error) {
      setValidationError('Search failed. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }

  // Filter properties based on selected filters
  const filteredResults = useMemo(() => {
    let results = [...searchResults]
    
    // Apply sorting
    switch (sortBy) {
      case 'price-low':
        results.sort((a, b) => (a.pricePerNight || 0) - (b.pricePerNight || 0))
        break
      case 'price-high':
        results.sort((a, b) => (b.pricePerNight || 0) - (a.pricePerNight || 0))
        break
      case 'newest':
        results.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        break
      case 'recommended':
      default:
        // Keep original order
        break
    }
    
    return results
  }, [searchResults, sortBy])

  const PropertyCard = ({ property }) => {
    const amenities = Array.isArray(property.amenities) ? property.amenities.slice(0, 3) : []
    
    // Get image - check photos array first, then fallback
    const photos = property.photos || property.images || []
    const primaryImage = photos.length > 0 ? photos[0] : null
    
    // Fallback images based on property type
    const fallbackImages = {
      'House': 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
      'Apartment': 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
      'Villa': 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80',
      'Condo': 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80',
      'default': 'https://images.unsplash.com/photo-1570129477492-45ac003ff2a0?w=800&q=80'
    }
    
    const imageUrl = primaryImage || fallbackImages[property.type] || fallbackImages.default
    const propertyId = property._id || property.id
    const pricePerNight = property.pricePerNight || property.price_per_night || 0
    const isFavorite = favoriteIds.has(String(propertyId))

    const toggleFavorite = async (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!propertyId) return
      if (!isAuthenticated) {
        navigate('/login', { state: { from: '/search' } })
        return
      }
      if (isFavorite) {
        dispatch(removeFavorite(propertyId))
      } else {
        dispatch(addFavorite(propertyId))
      }
    }
    
    return (
      <div className="listing-card group">
        <div className="listing-image">
          <img
            src={imageUrl}
            alt={property.title}
            loading="lazy"
            onError={(e) => {
              e.target.src = 'https://images.unsplash.com/photo-1570129477492-45ac003ff2a0?w=600&q=80'
            }}
          />
          <button
            onClick={toggleFavorite}
            className={`absolute top-4 right-4 wishlist-heart ${isFavorite ? 'active' : ''}`}
            title={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
          >
            <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className="p-6">
          <Link to={`/property/${propertyId}`} className="group/link">
            <h3 className="text-xl font-bold text-[var(--color-ink)] group-hover/link:text-[var(--color-primary)] transition-colors mb-2 line-clamp-2">
              {property.title}
            </h3>
          </Link>

          <div className="flex items-center gap-2 text-[var(--color-slate)] mb-3">
            <MapPin className="w-4 h-4" />
            <span className="text-sm">
              {[property.city, property.state, property.country].filter(Boolean).join(', ')}
            </span>
          </div>

          <div className="rating mb-4">
            <Star className="w-4 h-4 fill-current rating-star" />
            <span>4.8</span>
            <span className="text-[var(--color-mist)]">(128)</span>
          </div>

          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-2xl font-bold text-[var(--color-ink)]">
              ${pricePerNight}
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
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-snow)]">
      {/* Sticky Filter Bar */}
      <div className="filter-bar">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* Compact Search Bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--color-slate)]" />
                <input
                  type="text"
                  placeholder="Where to?"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="input pl-10 py-2"
                />
              </div>
            </div>

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="input py-2 w-40"
            />

            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || new Date().toISOString().split('T')[0]}
              className="input py-2 w-40"
            />

            <select
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              className="input py-2 w-32"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n}>{n} Guest{n > 1 ? 's' : ''}</option>
              ))}
            </select>

            <button
              onClick={onSearchHandler}
              disabled={loading || isSearching}
              className="btn btn-primary py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(loading || isSearching) ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Searching...
                </>
              ) : (
                <>
                  <SearchIcon className="w-5 h-5" />
                  Search
                </>
              )}
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn btn-tertiary py-2"
            >
              <SlidersHorizontal className="w-5 h-5" />
              Filters
            </button>
          </div>

          {/* Results Count */}
          {!(loading || isSearching) && filteredResults.length > 0 && (
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-[var(--color-slate)]">
                <span className="font-semibold text-[var(--color-ink)]">{filteredResults.length}</span> properties found
              </div>
              
              {/* Sort Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-[var(--color-slate)]">Sort by:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="input py-1 text-sm border-[var(--color-cloud)] focus:border-[var(--color-action)]"
                >
                  <option value="recommended">Recommended</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="newest">Newest First</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Validation Error */}
      {(error || validationError) && (
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl">
            {validationError || error}
          </div>
        </div>
      )}

      {/* Advanced Filters Modal */}
      {showFilters && (
        <div className="modal-overlay" onClick={() => setShowFilters(false)}>
          <div className="modal-content max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[var(--color-cloud)]">
              <div className="flex items-center justify-between">
                <h2 className="text-heading text-2xl font-bold">Filters</h2>
                <button onClick={() => setShowFilters(false)} className="p-2 hover:bg-[var(--color-fog)] rounded-lg">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-8">
              {/* Price Range */}
              <div>
                <h3 className="text-lg font-bold mb-4">Price Range</h3>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                    className="input"
                    placeholder="Min"
                  />
                  <span className="text-[var(--color-slate)]">to</span>
                  <input
                    type="number"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                    className="input"
                    placeholder="Max"
                  />
                </div>
              </div>

              {/* Property Types */}
              <div>
                <h3 className="text-lg font-bold mb-4">Property Type</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['House', 'Apartment', 'Villa', 'Condo'].map(type => (
                    <button
                      key={type}
                      onClick={() => {
                        setPropertyTypes(prev =>
                          prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
                        )
                      }}
                      className={`btn ${propertyTypes.includes(type) ? 'btn-primary' : 'btn-tertiary'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[var(--color-cloud)] flex justify-between">
              <button
                onClick={() => {
                  setPriceRange([0, 1000])
                  setPropertyTypes([])
                  setAmenities([])
                }}
                className="btn btn-ghost"
              >
                Clear All
              </button>
              <button onClick={() => setShowFilters(false)} className="btn btn-primary">
                Show {filteredResults.length} Properties
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Property Grid */}
      <div className="min-h-screen bg-[var(--color-pearl)] py-6">
        <div className="max-w-7xl mx-auto px-6">
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="skeleton h-96 rounded-2xl"></div>
              ))}
            </div>
          )}

          {!(loading || isSearching) && filteredResults.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="text-8xl mb-6">🏠</div>
              <h3 className="text-heading text-3xl font-bold text-[var(--color-ink)] mb-3">
                No properties found
              </h3>
              <p className="text-[var(--color-slate)] text-lg mb-8 max-w-md">
                We couldn't find any properties matching your search. Try adjusting your location, dates, or filters.
              </p>
              <button onClick={() => {
                setLocation('')
                setStartDate('')
                setEndDate('')
                setGuests(2)
                setPriceRange([0, 1000])
                setPropertyTypes([])
                setSortBy('recommended')
              }} className="btn btn-primary px-8 py-3">
                Clear All Filters
              </button>
            </div>
          )}

          {!(loading || isSearching) && filteredResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredResults.map(property => {
              const propertyId = property._id || property.id
              return (
              <PropertyCard
                  key={propertyId || property.title}
                  property={property}
                />
              )
            })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MapHighlights({ results, onHover, hoveredId }) {
  const clusters = React.useMemo(() => {
    const map = new Map()
    results.forEach((property) => {
      const key = [property.city, property.state, property.country].filter(Boolean).join(', ') || 'Unknown'
      if (!map.has(key)) {
        map.set(key, { key, count: 0, total: 0, sampleId: property._id || property.id })
      }
      const entry = map.get(key)
      entry.count += 1
      entry.total += property.pricePerNight || property.price_per_night || 0
    })
    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        average: entry.count ? Math.round(entry.total / entry.count) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
  }, [results])

  if (!clusters.length) {
    return null
  }

  return (
    <div className="space-y-3">
      {clusters.map((cluster) => (
        <button
          key={cluster.key}
          onMouseEnter={() => onHover(cluster.sampleId)}
          onMouseLeave={() => onHover(null)}
          className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 text-left border transition-all ${
            hoveredId === cluster.sampleId
              ? 'bg-white text-[var(--color-ink)] border-white'
              : 'bg-white/5 text-white border-white/10'
          }`}
        >
          <div>
            <p className="font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {cluster.key}
            </p>
            <p className="text-xs opacity-80">{cluster.count} stay{cluster.count === 1 ? '' : 's'} available</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">${cluster.average}</p>
            <p className="text-xs opacity-70">avg / night</p>
          </div>
        </button>
      ))}
    </div>
  )
}
