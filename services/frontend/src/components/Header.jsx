import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { logoutUser } from '../store/slices/authSlice'
import { Menu, X, User, Heart, Calendar, Home, LogOut, Settings, ChevronDown } from 'lucide-react'

const TRAVELER_API_BASE = import.meta.env.VITE_TRAVELER_API_URL || 'http://localhost:3001';

const resolveAvatarUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${TRAVELER_API_BASE}${path}`;
};

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const { user, isAuthenticated } = useSelector((state) => state.auth)

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const logout = async () => {
    try {
      await dispatch(logoutUser()).unwrap()
    } catch (error) {
      console.error('Logout failed', error)
    } finally {
      setUserMenuOpen(false)
      navigate('/login')
    }
  }

  const isActive = (path) => location.pathname === path

  // Hide header on certain pages for full immersion
  if (location.pathname === '/login' || location.pathname === '/signup') {
    return null
  }

  const avatarUrl = resolveAvatarUrl(user?.avatar_url || user?.avatar)

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-lg border-b border-[var(--color-cloud)] shadow-sm">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo - Clean & Minimal */}
          <Link
            to="/"
            className="flex items-center gap-3 group"
            aria-label="Go to homepage"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
              <Home className="w-6 h-6 text-white" aria-hidden="true" />
            </div>
            <span className="text-heading text-2xl font-bold text-[var(--color-ink)] hidden md:block">
              Stays
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {isAuthenticated && (
              <>
                {user?.role === 'TRAVELER' && (
                  <>
                    <Link
                      to="/search"
                      className={`text-sm font-semibold transition-colors ${isActive('/search')
                          ? 'text-[var(--color-primary)]'
                          : 'text-[var(--color-charcoal)] hover:text-[var(--color-ink)]'
                        }`}
                    >
                      Search
                    </Link>
                    <Link
                      to="/favourites"
                      className={`flex items-center gap-2 text-sm font-semibold transition-colors ${(isActive('/favorites') || isActive('/favourites'))
                          ? 'text-[var(--color-primary)]'
                          : 'text-[var(--color-charcoal)] hover:text-[var(--color-ink)]'
                        }`}
                    >
                      <Heart className="w-4 h-4" />
                      Favourites
                    </Link>
                    <Link
                      to="/bookings"
                      className={`flex items-center gap-2 text-sm font-semibold transition-colors ${isActive('/bookings')
                          ? 'text-[var(--color-primary)]'
                          : 'text-[var(--color-charcoal)] hover:text-[var(--color-ink)]'
                        }`}
                    >
                      <Calendar className="w-4 h-4" />
                      My bookings
                    </Link>
                  </>
                )}

                {user?.role === 'OWNER' && (
                  <>
                    <Link
                      to="/dashboard"
                      className={`text-sm font-semibold transition-colors ${isActive('/dashboard')
                          ? 'text-[var(--color-primary)]'
                          : 'text-[var(--color-charcoal)] hover:text-[var(--color-ink)]'
                        }`}
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/owner/properties"
                      className={`text-sm font-semibold transition-colors ${isActive('/owner/properties')
                          ? 'text-[var(--color-primary)]'
                          : 'text-[var(--color-charcoal)] hover:text-[var(--color-ink)]'
                        }`}
                    >
                      Properties
                    </Link>
                    <Link
                      to="/owner/new"
                      className={`text-sm font-semibold transition-colors ${isActive('/owner/new')
                          ? 'text-[var(--color-primary)]'
                          : 'text-[var(--color-charcoal)] hover:text-[var(--color-ink)]'
                        }`}
                    >
                      Host
                    </Link>
                  </>
                )}
              </>
            )}

            {!isAuthenticated && (
              <Link
                to="/search"
                className="text-sm font-semibold text-[var(--color-charcoal)] hover:text-[var(--color-ink)] transition-colors"
              >
                Search
              </Link>
            )}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            {!isAuthenticated ? (
              <>
                <button
                  onClick={() => navigate('/signup?role=OWNER')}
                  className="hidden md:block text-sm font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary)] transition-colors"
                >
                  Become a Host
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="btn btn-tertiary btn-sm"
                >
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="hidden md:inline-flex btn btn-primary btn-sm"
                >
                  Sign Up
                </button>
              </>
            ) : (
              <div className="relative flex items-center gap-3">
                {user?.name && (
                  <Link
                    to="/profile"
                    className="text-sm font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary)] transition-colors"
                  >
                    {user.name}
                  </Link>
                )}
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-3 px-4 py-2 rounded-full border-2 border-[var(--color-cloud)] hover:shadow-md transition-all"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-dark)] overflow-hidden flex items-center justify-center text-white font-semibold text-sm">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={`${user?.name || 'Profile'} avatar`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{user?.name?.[0]?.toUpperCase() || 'U'}</span>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-[var(--color-slate)] transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* User Dropdown Menu */}
                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    ></div>
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-[var(--color-cloud)] py-2 z-50 animate-slide-down">
                      <div className="px-4 py-3 border-b border-[var(--color-cloud)]">
                        <div className="font-semibold text-[var(--color-ink)]">{user?.name}</div>
                        <div className="text-sm text-[var(--color-slate)]">{user?.email}</div>
                        <div className="mt-2">
                          <span className="badge badge-primary text-xs">
                            {user?.role === 'OWNER' ? 'Host' : 'Traveler'}
                          </span>
                        </div>
                      </div>

                      <div className="py-2">
                        <button
                          onClick={() => {
                            navigate('/profile')
                            setUserMenuOpen(false)
                          }}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--color-fog)] transition-colors text-left"
                        >
                          <User className="w-5 h-5 text-[var(--color-slate)]" />
                          <span className="font-medium text-[var(--color-ink)]">Profile</span>
                        </button>

                        {user?.role === 'TRAVELER' && (
                          <>
                            <button
                              onClick={() => {
                                navigate('/bookings')
                                setUserMenuOpen(false)
                              }}
                              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--color-fog)] transition-colors text-left"
                            >
                              <Calendar className="w-5 h-5 text-[var(--color-slate)]" />
                              <span className="font-medium text-[var(--color-ink)]">My bookings</span>
                            </button>
                            <button
                              onClick={() => {
                                navigate('/favourites')
                                setUserMenuOpen(false)
                              }}
                              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--color-fog)] transition-colors text-left"
                            >
                              <Heart className="w-5 h-5 text-[var(--color-slate)]" />
                              <span className="font-medium text-[var(--color-ink)]">Favourites</span>
                            </button>
                          </>
                        )}

                        {user?.role === 'OWNER' && (
                          <>
                            <button
                              onClick={() => {
                                navigate('/dashboard')
                                setUserMenuOpen(false)
                              }}
                              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--color-fog)] transition-colors text-left"
                            >
                              <Home className="w-5 h-5 text-[var(--color-slate)]" />
                              <span className="font-medium text-[var(--color-ink)]">Dashboard</span>
                            </button>
                            <button
                              onClick={() => {
                                navigate('/owner/properties')
                                setUserMenuOpen(false)
                              }}
                              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--color-fog)] transition-colors text-left"
                            >
                              <Settings className="w-5 h-5 text-[var(--color-slate)]" />
                              <span className="font-medium text-[var(--color-ink)]">Properties</span>
                            </button>
                            <button
                              onClick={() => {
                                navigate('/owner/new')
                                setUserMenuOpen(false)
                              }}
                              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--color-fog)] transition-colors text-left"
                            >
                              <Home className="w-5 h-5 text-[var(--color-slate)]" />
                              <span className="font-medium text-[var(--color-ink)]">Host</span>
                            </button>
                          </>
                        )}
                      </div>

                      <div className="border-t border-[var(--color-cloud)] pt-2">
                        <button
                          onClick={logout}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--color-fog)] transition-colors text-left text-[var(--color-error)]"
                        >
                          <LogOut className="w-5 h-5" />
                          <span className="font-medium">Logout</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-[var(--color-fog)] transition-colors"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-[var(--color-ink)]" aria-hidden="true" />
              ) : (
                <Menu className="w-6 h-6 text-[var(--color-ink)]" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-[var(--color-cloud)] animate-slide-down">
            {isAuthenticated ? (
              <div className="space-y-2">
                {user?.role === 'TRAVELER' && (
                  <>
                    <Link
                      to="/search"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 rounded-lg hover:bg-[var(--color-fog)] transition-colors font-medium"
                    >
                      Search
                    </Link>
                    <Link
                      to="/favourites"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 rounded-lg hover:bg-[var(--color-fog)] transition-colors font-medium"
                    >
                      Favourites
                    </Link>
                    <Link
                      to="/bookings"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 rounded-lg hover:bg-[var(--color-fog)] transition-colors font-medium"
                    >
                      My bookings
                    </Link>
                  </>
                )}
                {user?.role === 'OWNER' && (
                  <>
                    <Link
                      to="/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 rounded-lg hover:bg-[var(--color-fog)] transition-colors font-medium"
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/owner/properties"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 rounded-lg hover:bg-[var(--color-fog)] transition-colors font-medium"
                    >
                      Properties
                    </Link>
                    <Link
                      to="/owner/new"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 rounded-lg hover:bg-[var(--color-fog)] transition-colors font-medium"
                    >
                      Host
                    </Link>
                  </>
                )}
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 rounded-lg hover:bg-[var(--color-fog)] transition-colors font-medium"
                >
                  Profile
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <Link
                  to="/search"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 rounded-lg hover:bg-[var(--color-fog)] transition-colors font-medium"
                >
                  Search
                </Link>
                <Link
                  to="/signup?role=OWNER"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 rounded-lg hover:bg-[var(--color-fog)] transition-colors font-medium"
                >
                  Become a Host
                </Link>
                <div className="pt-2 space-y-2">
                  <button
                    onClick={() => {
                      navigate('/login')
                      setMobileMenuOpen(false)
                    }}
                    className="w-full btn btn-tertiary"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      navigate('/signup')
                      setMobileMenuOpen(false)
                    }}
                    className="w-full btn btn-primary"
                  >
                    Sign Up
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
