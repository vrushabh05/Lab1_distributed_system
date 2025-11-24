import React, { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchCurrentUser, updateProfile, uploadAvatar } from '../store/slices/authSlice'

const COUNTRIES = ["USA", "Canada", "India", "United Kingdom", "Germany", "France", "Australia", "Brazil", "Japan", "Other"]
const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "IA", "ID", "IL", "IN", "KS",
  "KY", "LA", "MA", "MD", "ME", "MI", "MN", "MO", "MS", "MT", "NC", "ND", "NE", "NH", "NJ", "NM",
  "NV", "NY", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VA", "VT", "WA", "WI",
  "WV", "WY"
]

const TRAVELER_API_BASE = import.meta.env.VITE_TRAVELER_API_URL || 'http://localhost:3001';

const resolveAvatarUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${TRAVELER_API_BASE}${path}`;
};

export default function Profile() {
  const dispatch = useDispatch()
  const { user: profile, loading, error: authError } = useSelector((state) => state.auth)

  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [localProfile, setLocalProfile] = useState(null)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (!profile && !loading && !authError) {
      dispatch(fetchCurrentUser())
    }
  }, [dispatch, profile, loading, authError])

  useEffect(() => {
    if (profile) {
      setLocalProfile({ ...profile })
    }
  }, [profile])

  const isUSA = useMemo(() => (localProfile?.country || '').toUpperCase() === 'USA', [localProfile?.country])

  const save = async () => {
    setErr(null)
    setMsg(null)

    if (!localProfile) return

    try {
      const next = { ...localProfile }

      // Validate and normalize state for USA
      if (isUSA && next.state) {
        next.state = next.state.toUpperCase().trim().slice(0, 2)
        if (next.state && !US_STATES.includes(next.state)) {
          setErr('Please select a valid US state from the dropdown.')
          return
        }
      }

      const { name, phone, about, city, state, country, languages, gender } = next
      const result = await dispatch(updateProfile({ name, phone, about, city, state, country, languages, gender }))

      if (updateProfile.fulfilled.match(result)) {
        setMsg('Saved')
        // Update localProfile with the response to ensure view mode shows latest data
        if (result.payload) {
          setLocalProfile({ ...localProfile, ...result.payload })
        }
        setIsEditing(false) // Switch back to view mode after save
        setTimeout(() => setMsg(null), 3000)
      } else {
        setErr(result.payload || 'Save failed')
      }
    } catch (e) {
      setErr(e?.message || 'Save failed')
    }
  }

  const upload = async () => {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('avatar', file)
      const result = await dispatch(uploadAvatar(fd))

      if (uploadAvatar.fulfilled.match(result)) {
        setErr(null)
        setMsg('Avatar updated successfully!')
        setFile(null)
        setTimeout(() => setMsg(null), 3000)
      } else {
        setErr(result.payload || 'Upload failed')
      }
    } catch (e) {
      setErr(e?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 flex flex-col items-center justify-center">
        <div className="text-red-600 text-lg mb-4">
          {authError || 'Please log in to view your profile.'}
        </div>
        <button
          onClick={() => window.location.href = '/login'}
          className="bg-rose-500 text-white px-6 py-2 rounded-lg hover:bg-rose-600 transition"
        >
          Go to Login
        </button>
      </div>
    )
  }

  if (!localProfile) return null

  const avatarUrl = resolveAvatarUrl(localProfile?.avatar_url || localProfile?.avatar)

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 md:px-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-2">👤 My Profile</h1>
          <p className="text-lg text-gray-600">
            {isEditing ? 'Update your personal information' : 'View your profile information'}
          </p>
        </div>

        {/* Success Message */}
        {msg && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 font-medium">✅ {msg}</p>
          </div>
        )}

        {/* Error Message */}
        {err && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 font-medium">⚠️ {err}</p>
          </div>
        )}

        {/* View Mode */}
        {!isEditing && (
          <div className="space-y-6">
            {/* Profile Picture */}
            <div className="bg-white rounded-lg shadow-md p-8">
              <div className="flex flex-col items-center">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-rose-100 to-pink-100 flex items-center justify-center text-6xl overflow-hidden border-4 border-rose-200 mb-4">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>👤</span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{localProfile?.name || 'No name set'}</h2>
                <p className="text-gray-600">{localProfile?.email}</p>
              </div>
            </div>

            {/* Personal Information */}
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">ℹ️ Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">📞 Phone</p>
                  <p className="text-gray-900">{localProfile?.phone || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">⚧️ Gender</p>
                  <p className="text-gray-900">{localProfile?.gender || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">🏙️ City</p>
                  <p className="text-gray-900">{localProfile?.city || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">🗺️ State/Region</p>
                  <p className="text-gray-900">{localProfile?.state || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">🌍 Country</p>
                  <p className="text-gray-900">{localProfile?.country || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">🗣️ Languages</p>
                  <p className="text-gray-900">{localProfile?.languages || 'Not provided'}</p>
                </div>
              </div>
              {localProfile?.about && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-sm font-semibold text-gray-600 mb-2">📝 About</p>
                  <p className="text-gray-900">{localProfile.about}</p>
                </div>
              )}
            </div>

            {/* Edit Button */}
            <button
              onClick={() => setIsEditing(true)}
              className="w-full bg-gradient-to-r from-rose-500 to-pink-500 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition"
            >
              ✏️ Edit Profile
            </button>
          </div>
        )}

        {/* Edit Mode */}
        {isEditing && (
          <div className="space-y-6">
            {/* Avatar Section */}
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">📸 Profile Picture</h2>
              <div className="flex flex-col md:flex-row items-center gap-6">
                {/* Avatar Display */}
                <div className="flex-shrink-0">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-rose-100 to-pink-100 flex items-center justify-center text-6xl overflow-hidden border-4 border-rose-200">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span>👤</span>
                    )}
                  </div>
                </div>

                {/* Upload Controls */}
                <div className="flex-1">
                  <label className="block mb-3">
                    <div className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-rose-300 rounded-lg cursor-pointer hover:bg-rose-50 transition">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => setFile(e.target.files[0])}
                        className="hidden"
                      />
                      <div className="text-center">
                        <p className="text-rose-600 font-semibold">📁 Choose Image</p>
                        <p className="text-sm text-gray-600">or drag and drop</p>
                      </div>
                    </div>
                  </label>
                  {file && (
                    <button
                      onClick={upload}
                      disabled={uploading}
                      className="w-full bg-gradient-to-r from-rose-500 to-pink-500 text-white px-4 py-3 rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50"
                    >
                      {uploading ? '⏳ Uploading...' : '✅ Upload Image'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">ℹ️ Personal Information</h2>

              {/* Name */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">👤 Full Name</label>
                <input
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-rose-500 focus:outline-none transition"
                  placeholder="Enter your full name"
                  value={localProfile.name || ''}
                  onChange={e => setLocalProfile({ ...localProfile, name: e.target.value })}
                />
              </div>

              {/* Phone & Gender */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">📞 Phone</label>
                  <input
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-rose-500 focus:outline-none transition"
                    placeholder="Phone"
                    value={localProfile.phone || ''}
                    onChange={e => setLocalProfile({ ...localProfile, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">⚧️ Gender</label>
                  <input
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-rose-500 focus:outline-none transition"
                    placeholder="Gender"
                    value={localProfile.gender || ''}
                    onChange={e => setLocalProfile({ ...localProfile, gender: e.target.value })}
                  />
                </div>
              </div>

              {/* Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">🏙️ City</label>
                  <input
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-rose-500 focus:outline-none transition"
                    placeholder="City"
                    value={localProfile.city || ''}
                    onChange={e => setLocalProfile({ ...localProfile, city: e.target.value })}
                  />
                </div>
                {isUSA ? (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">🗺️ State</label>
                    <select
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-rose-500 focus:outline-none transition"
                      value={localProfile.state || ''}
                      onChange={e => setLocalProfile({ ...localProfile, state: e.target.value.toUpperCase() })}
                    >
                      <option value="">Select State</option>
                      {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">🗺️ State/Region</label>
                    <input
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-rose-500 focus:outline-none transition"
                      placeholder="State"
                      value={localProfile.state || ''}
                      onChange={e => setLocalProfile({ ...localProfile, state: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {/* Country & Languages */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">🌍 Country</label>
                  <select
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-rose-500 focus:outline-none transition"
                    value={localProfile.country || ''}
                    onChange={e => setLocalProfile({ ...localProfile, country: e.target.value })}
                  >
                    <option value="">Select Country</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">🗣️ Languages</label>
                  <input
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-rose-500 focus:outline-none transition"
                    placeholder="e.g., English, Spanish, French"
                    value={localProfile.languages || ''}
                    onChange={e => setLocalProfile({ ...localProfile, languages: e.target.value })}
                  />
                </div>
              </div>

              {/* About */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-700 mb-2">📝 About You</label>
                <textarea
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-rose-500 focus:outline-none transition h-24"
                  placeholder="Tell us about yourself..."
                  value={localProfile.about || ''}
                  onChange={e => setLocalProfile({ ...localProfile, about: e.target.value })}
                />
              </div>

              {/* Save and Cancel Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setLocalProfile({ ...profile }) // Reset to original
                    setIsEditing(false)
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                >
                  ✖️ Cancel
                </button>
                <button
                  onClick={save}
                  disabled={loading}
                  aria-label="Save"
                  className="flex-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50"
                >
                  {loading ? '⏳ Saving...' : '💾 Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
