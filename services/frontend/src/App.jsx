import React, { useEffect, Suspense, lazy } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchCurrentUser } from './store/slices/authSlice'
import { ToastProvider } from './context/ToastContext'
import ErrorBoundary from './components/ErrorBoundary'
import Header from './components/Header'
import AgentButton from './components/AgentButton'

// Eagerly load critical pages
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'

// Lazy load non-critical pages
const Profile = lazy(() => import('./pages/Profile'))
const Search = lazy(() => import('./pages/Search'))
const PropertyDetails = lazy(() => import('./pages/PropertyDetails'))
const Checkout = lazy(() => import('./pages/Checkout'))
const Favorites = lazy(() => import('./pages/Favorites'))
const TravelerBookings = lazy(() => import('./pages/TravelerBookings'))
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard'))
const OwnerProperties = lazy(() => import('./pages/OwnerProperties'))
const NewProperty = lazy(() => import('./pages/NewProperty'))

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
  </div>
)

export default function App() {
  const dispatch = useDispatch()
  const { isAuthenticated, user } = useSelector((state) => state.auth)

  useEffect(() => {
    // Try to fetch current user if token exists
    const token = localStorage.getItem('token')
    if (token) {
      dispatch(fetchCurrentUser())
    }
  }, [dispatch])

  return (
    <ToastProvider>
      <ErrorBoundary>
        <div className="min-h-screen bg-white">
          {/* Global Header - Clean & Minimal */}
          <Header />

          {/* Main Content */}
          <main>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/search" element={<Search />} />
                <Route path="/property/:id" element={<PropertyDetails />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/bookings" element={<TravelerBookings />} />
                <Route path="/dashboard" element={<OwnerDashboard />} />
                <Route path="/owner/properties" element={<OwnerProperties />} />
                <Route path="/owner/new" element={<NewProperty />} />
              </Routes>
            </Suspense>
          </main>

          {/* AI Agent - Only show for authenticated travelers */}
          {isAuthenticated && user?.role === 'TRAVELER' && <AgentButton />}
        </div>
      </ErrorBoundary>
    </ToastProvider>
  )
}

