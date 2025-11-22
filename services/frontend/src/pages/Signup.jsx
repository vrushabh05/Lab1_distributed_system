import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { signup } from '../store/slices/authSlice'
import { Check, X } from 'lucide-react'

export default function Signup() {
  const nav = useNavigate()
  const dispatch = useDispatch()
  const [searchParams] = useSearchParams()
  const { loading, error } = useSelector((state) => state.auth)
  
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(searchParams.get('role') || 'TRAVELER')
  const [showPasswordHints, setShowPasswordHints] = useState(false)
  
  // Password validation
  const passwordChecks = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[@$!%*?&]/.test(password)
  }
  
  const isPasswordValid = Object.values(passwordChecks).every(Boolean)

  const submit = async (e) => {
    e.preventDefault()
    
    if (!isPasswordValid) {
      return // Password validation will show visual feedback
    }
    
    const result = await dispatch(signup({ role, name, email, password }))
    if (signup.fulfilled.match(result)) {
      nav('/')
    }
  }

  const PasswordRequirement = ({ met, text }) => (
    <div className={`flex items-center gap-2 text-xs ${met ? 'text-green-600' : 'text-gray-500'}`}>
      {met ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      <span>{text}</span>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-50 flex items-center justify-center py-12 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Join Stays</h1>
          <p className="text-gray-600">Create your account to get started</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* Role Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">I want to</label>
            <select 
              value={role} 
              onChange={e => setRole(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-200 transition"
            >
              <option value="TRAVELER">🧳 Book places to stay (Traveler)</option>
              <option value="OWNER">🏠 List my property (Host)</option>
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
            <input 
              type="text"
              placeholder="John Smith"
              value={name} 
              onChange={e => setName(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-200 transition"
              required
              minLength={2}
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
            <input 
              type="email"
              placeholder="you@example.com"
              value={email} 
              onChange={e => setEmail(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-200 transition"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
            <input 
              type="password"
              placeholder="••••••••"
              value={password} 
              onChange={e => setPassword(e.target.value)}
              onFocus={() => setShowPasswordHints(true)}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-200 transition"
              required
            />
            
            {/* Password Requirements */}
            {showPasswordHints && password && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-1">
                <PasswordRequirement met={passwordChecks.minLength} text="At least 8 characters" />
                <PasswordRequirement met={passwordChecks.hasUpper} text="One uppercase letter" />
                <PasswordRequirement met={passwordChecks.hasLower} text="One lowercase letter" />
                <PasswordRequirement met={passwordChecks.hasNumber} text="One number" />
                <PasswordRequirement met={passwordChecks.hasSpecial} text="One special character (@$!%*?&)" />
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              ✕ {error}
            </div>
          )}

          {/* Submit Button */}
          <button 
            type="submit"
            disabled={loading || (showPasswordHints && !isPasswordValid)}
            className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-lg transition transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        {/* Demo Credentials */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-semibold text-blue-900 mb-2">📝 Quick Test Accounts:</p>
          <div className="space-y-1 text-xs text-gray-700">
            <div><strong>Owner:</strong> owner@example.com / password123</div>
            <div><strong>Traveler:</strong> traveler@example.com / password123</div>
          </div>
        </div>

        {/* Login Link */}
        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm">
            Already have an account? 
            <Link to="/login" className="text-rose-500 hover:text-rose-600 font-semibold ml-1">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
