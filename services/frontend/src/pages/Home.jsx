import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MapPin, Calendar, Users, ChevronRight } from 'lucide-react'
import OptimizedImage from '../components/OptimizedImage'

export default function Home() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState({
    location: '',
    checkIn: '',
    checkOut: '',
    guests: 1
  })

  const handleSearch = (e) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (searchQuery.location) params.append('location', searchQuery.location)
    if (searchQuery.checkIn) params.append('checkIn', searchQuery.checkIn)
    if (searchQuery.checkOut) params.append('checkOut', searchQuery.checkOut)
    if (searchQuery.guests) params.append('guests', searchQuery.guests)
    navigate(`/search?${params.toString()}`)
  }

  const curatedCategories = [
    {
      title: 'Unique Stays',
      subtitle: 'One-of-a-kind places',
      image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
      tag: 'CURATED'
    },
    {
      title: 'Beachfront',
      subtitle: 'Wake up to ocean views',
      image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80',
      tag: 'COASTAL'
    },
    {
      title: 'Design Icons',
      subtitle: 'Architectural masterpieces',
      image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
      tag: 'EDITORIAL'
    },
    {
      title: 'In the Forest',
      subtitle: 'Surrounded by nature',
      image: 'https://images.unsplash.com/photo-1542718610-a1d656d1884c?w=800&q=80',
      tag: 'RUSTIC'
    }
  ]

  const featuredStays = [
    {
      id: 1,
      image: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800&q=80',
      location: 'Santorini, Greece',
      title: 'Cliffside Villa with Infinity Pool',
      price: 450,
      rating: 4.9,
      reviews: 128
    },
    {
      id: 2,
      image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80',
      location: 'Kyoto, Japan',
      title: 'Traditional Machiya House',
      price: 280,
      rating: 5.0,
      reviews: 87
    },
    {
      id: 3,
      image: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80',
      location: 'Tulum, Mexico',
      title: 'Beachfront Eco-Lodge',
      price: 320,
      rating: 4.8,
      reviews: 156
    },
    {
      id: 4,
      image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
      location: 'Iceland',
      title: 'Glass Igloo Northern Lights',
      price: 520,
      rating: 5.0,
      reviews: 203
    }
  ].map(stay => ({ ...stay, isSample: true }))

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - Magazine Cover */}
      <section className="relative h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        {/* Background Image with Optimized Loading */}
        <div className="absolute inset-0">
          <OptimizedImage
            src="https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1920&q=90"
            alt="Luxury accommodation"
            priority={true}
            aspectRatio="auto"
            className="w-full h-full"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60"></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <h1 className="text-heading text-6xl md:text-7xl lg:text-8xl font-bold text-white mb-6 tracking-tight animate-fade-in">
            From Inspiration<br/>to Arrival
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-12 font-light max-w-2xl mx-auto">
            Discover curated stays that transform your journey into an experience
          </p>

          {/* Powerful Search Bar */}
          <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-2xl p-4 max-w-4xl mx-auto animate-slide-up">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Location */}
              <div className="flex items-center gap-3 px-4 py-3 border-r border-gray-200">
                <MapPin className="w-5 h-5 text-[var(--color-primary)]" />
                <input
                  type="text"
                  placeholder="Where to?"
                  value={searchQuery.location}
                  onChange={(e) => setSearchQuery({...searchQuery, location: e.target.value})}
                  className="w-full bg-transparent outline-none text-gray-900 placeholder:text-gray-500 font-medium"
                />
              </div>

              {/* Check-in */}
              <div className="flex items-center gap-3 px-4 py-3 border-r border-gray-200">
                <Calendar className="w-5 h-5 text-[var(--color-primary)]" />
                <input
                  type="date"
                  value={searchQuery.checkIn}
                  onChange={(e) => setSearchQuery({...searchQuery, checkIn: e.target.value})}
                  className="w-full bg-transparent outline-none text-gray-900 font-medium"
                />
              </div>

              {/* Check-out */}
              <div className="flex items-center gap-3 px-4 py-3 border-r border-gray-200">
                <Calendar className="w-5 h-5 text-[var(--color-primary)]" />
                <input
                  type="date"
                  value={searchQuery.checkOut}
                  onChange={(e) => setSearchQuery({...searchQuery, checkOut: e.target.value})}
                  className="w-full bg-transparent outline-none text-gray-900 font-medium"
                />
              </div>

              {/* Guests + Search Button */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-3 px-4 py-3 flex-1">
                  <Users className="w-5 h-5 text-[var(--color-primary)]" />
                  <select
                    value={searchQuery.guests}
                    onChange={(e) => setSearchQuery({...searchQuery, guests: e.target.value})}
                    className="w-full bg-transparent outline-none text-gray-900 font-medium cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                      <option key={n} value={n}>{n} Guest{n > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn btn-primary h-full px-6 rounded-xl">
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/60 rounded-full flex items-start justify-center p-2">
            <div className="w-1 h-3 bg-white/60 rounded-full"></div>
          </div>
        </div>
      </section>

      {/* Curated Categories - Editorial Style */}
      <section className="py-24 px-6 bg-[var(--color-snow)]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-heading text-5xl md:text-6xl font-bold text-[var(--color-ink)] mb-4">
              Curated Collections
            </h2>
            <p className="text-xl text-[var(--color-charcoal)] max-w-2xl mx-auto">
              Hand-picked stays for the discerning traveler
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {curatedCategories.map((category, index) => (
              <div
                key={index}
                className="group relative h-96 rounded-3xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-500"
                onClick={() => navigate(`/search?location=${encodeURIComponent(category.subtitle)}`)}
              >
                <OptimizedImage
                  src={category.image}
                  alt={category.title}
                  aspectRatio="auto"
                  loading="lazy"
                  className="w-full h-full transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <div className="badge badge-accent mb-4">{category.tag}</div>
                  <h3 className="text-heading text-4xl font-bold text-white mb-2">
                    {category.title}
                  </h3>
                  <p className="text-white/90 text-lg mb-4">{category.subtitle}</p>
                  <div className="flex items-center gap-2 text-white font-semibold group-hover:gap-4 transition-all">
                    <span>Explore</span>
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Stays - Premium Grid */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-heading text-5xl font-bold text-[var(--color-ink)] mb-4">
                Featured Stays
              </h2>
              <p className="text-xl text-[var(--color-charcoal)]">
                Exceptional properties chosen by our curators
              </p>
            </div>
            <button 
              onClick={() => navigate('/search')}
              className="btn btn-tertiary hidden md:inline-flex"
            >
              View All
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {featuredStays.map((stay) => (
              <div
                key={stay.id}
                className="listing-card"
                onClick={() => navigate(`/search?location=${encodeURIComponent(stay.location)}`)}
              >
                <div className="listing-card-image">
                  <OptimizedImage 
                    src={stay.image} 
                    alt={stay.title}
                    aspectRatio="4/3"
                  />
                  <button className="absolute top-4 right-4 wishlist-heart">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </div>
                
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-[var(--color-slate)]">
                      {stay.location}
                    </span>
                    {stay.isSample && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[var(--color-cloud)] text-[var(--color-slate)]">
                        Demo
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-bold text-[var(--color-ink)] mb-3 line-clamp-2">
                    {stay.title}
                  </h3>
                  
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-[var(--color-ink)]">
                      ${stay.price}
                    </span>
                    <span className="text-[var(--color-slate)] text-sm">/ night</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12 md:hidden">
            <button onClick={() => navigate('/search')} className="btn btn-primary btn-lg">
              View All Properties
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-24 px-6 bg-[var(--color-primary)] text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div>
              <div className="text-5xl font-bold text-[var(--color-accent)] mb-4">10M+</div>
              <h3 className="text-2xl font-semibold mb-2">Trusted Guests</h3>
              <p className="text-white/80">Worldwide community of travelers</p>
            </div>
            <div>
              <div className="text-5xl font-bold text-[var(--color-accent)] mb-4">50K+</div>
              <h3 className="text-2xl font-semibold mb-2">Unique Stays</h3>
              <p className="text-white/80">Hand-curated properties</p>
            </div>
            <div>
              <div className="text-5xl font-bold text-[var(--color-accent)] mb-4">4.9</div>
              <h3 className="text-2xl font-semibold mb-2">Average Rating</h3>
              <p className="text-white/80">Excellence in every stay</p>
            </div>
          </div>
        </div>
      </section>

      {/* Host CTA */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-heading text-5xl md:text-6xl font-bold text-[var(--color-ink)] mb-6">
            Share Your Space
          </h2>
          <p className="text-xl text-[var(--color-charcoal)] mb-10 max-w-2xl mx-auto">
            Join our community of hosts and welcome travelers from around the world
          </p>
          <button
            onClick={() => navigate('/signup?role=OWNER')}
            className="btn btn-primary btn-lg"
          >
            Become a Host
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </section>
    </div>
  )
}
