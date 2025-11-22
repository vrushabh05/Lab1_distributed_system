import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { createProperty } from '../store/slices/propertiesSlice'
import axios from 'axios'

const PROPERTY_API_URL = import.meta.env.VITE_PROPERTY_API_URL || import.meta.env.VITE_PROPERTY_API || 'http://localhost:7003'

const initialForm = {
  title: '',
  type: 'Apartment',
  description: '',
  address: '',
  city: '',
  state: '',
  country: 'USA',
  pricePerNight: 100,
  bedrooms: 1,
  bathrooms: 1,
  maxGuests: 2
}

export default function NewProperty() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { loading } = useSelector((state) => state.properties)
  const { user, token } = useSelector((state) => state.auth)
  
  const [form, setForm] = useState(initialForm)
  const [amenitiesText, setAmenitiesText] = useState('')
  const [imageFiles, setImageFiles] = useState([])
  const [previewImages, setPreviewImages] = useState([])
  
  // Check if user is an owner
  useEffect(() => {
    if (user && user.role !== 'OWNER') {
      navigate('/')
    }
  }, [user, navigate])
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)
  const [uploading, setUploading] = useState(false)

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || [])
    setImageFiles(prev => [...prev, ...files])

    // Create previews
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (event) => {
        setPreviewImages(prev => [...prev, event.target.result])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index))
    setPreviewImages(prev => prev.filter((_, i) => i !== index))
  }

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    setMsg(null)

    if (!form.title || !form.city || !form.country) {
      setErr('Title, city, and country are required.')
      return
    }

    const normalizeArray = (value) =>
      value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)

    const payload = {
      ...form,
      pricePerNight: Number(form.pricePerNight) || 0,
      bedrooms: Number(form.bedrooms) || 0,
      bathrooms: Number(form.bathrooms) || 0,
      maxGuests: Number(form.maxGuests) || 1,
      state: form.country?.toUpperCase() === 'USA' && form.state
        ? form.state.toUpperCase().slice(0, 2)
        : form.state,
      amenities: amenitiesText ? normalizeArray(amenitiesText) : [],
      photos: []
    }

    if (payload.pricePerNight <= 0) {
      setErr('Price per night must be greater than 0.')
      return
    }
    if (payload.maxGuests < 1) {
      setErr('Max guests must be at least 1.')
      return
    }

    try {
      // Create property first
      const result = await dispatch(createProperty(payload))
      
      if (createProperty.rejected.match(result)) {
        setErr(result.payload || 'Failed to create property')
        return
      }
      
      const propertyId = result.payload.id || result.payload._id

      // Upload images if any
      if (imageFiles.length > 0) {
        setUploading(true)
        for (let i = 0; i < imageFiles.length; i++) {
          const formData = new FormData()
          formData.append('file', imageFiles[i])
          formData.append('propertyId', propertyId)

          await axios.post(`${PROPERTY_API_URL}/api/properties/upload-image`, formData, {
            headers: { 
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${token}`
            }
          })
        }
        setUploading(false)
      }

      setMsg(`Property created successfully! ID: ${propertyId}`)
      setForm({ ...initialForm })
      setAmenitiesText('')
      setImageFiles([])
      setPreviewImages([])
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || 'Create failed')
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🏠 List Your Property</h1>
        </div>

        <form onSubmit={submit} className="space-y-8">
          {/* Basic Info */}
          <div className="bg-white rounded-lg shadow p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Basic Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Property Title *</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  placeholder="e.g., Cozy Downtown Loft with City Views"
                  value={form.title}
                  onChange={e => update('title', e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Property Type</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.type}
                    onChange={e => update('type', e.target.value)}
                  >
                    <option>Apartment</option>
                    <option>House</option>
                    <option>Condo</option>
                    <option>Villa</option>
                    <option>Studio</option>
                    <option>Townhouse</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Max Guests</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    type="number"
                    min={1}
                    value={form.maxGuests}
                    onChange={e => update('maxGuests', Number(e.target.value) || 1)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description *</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent h-32"
                  placeholder="Describe your property in detail..."
                  value={form.description}
                  onChange={e => update('description', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="bg-white rounded-lg shadow p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Location</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  placeholder="Street address"
                  value={form.address}
                  onChange={e => update('address', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">City *</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    placeholder="City"
                    value={form.city}
                    onChange={e => update('city', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">State/Province</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    placeholder="State"
                    value={form.state}
                    onChange={e => update('state', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Country *</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    placeholder="Country"
                    value={form.country}
                    onChange={e => update('country', e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Amenities & Details */}
          <div className="bg-white rounded-lg shadow p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Amenities & Details</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Bedrooms</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    type="number"
                    min={1}
                    value={form.bedrooms}
                    onChange={e => update('bedrooms', Number(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Bathrooms</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    type="number"
                    min={1}
                    value={form.bathrooms}
                    onChange={e => update('bathrooms', Number(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Price per Night</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    type="number"
                    min={1}
                    value={form.pricePerNight}
                    onChange={e => update('pricePerNight', Number(e.target.value) || 100)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Amenities (comma separated)</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  placeholder="e.g., WiFi, Kitchen, Gym, Parking, Air Conditioning"
                  value={amenitiesText}
                  onChange={e => setAmenitiesText(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Images */}
          <div className="bg-white rounded-lg shadow p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Photos</h2>
            
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-rose-500 transition">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  id="imageInput"
                />
                <label htmlFor="imageInput" className="cursor-pointer block">
                  <div className="text-4xl mb-2">📸</div>
                  <p className="text-gray-700 font-semibold">Click to upload photos</p>
                  <p className="text-gray-500 text-sm mt-1">or drag and drop</p>
                  <p className="text-gray-400 text-xs mt-2">PNG, JPG, GIF up to 10MB</p>
                </label>
              </div>

              {/* Image Previews */}
              {previewImages.length > 0 && (
                <div>
                  <p className="font-semibold text-gray-700 mb-4">{previewImages.length} photo(s) selected</p>
                  <div className="grid grid-cols-3 gap-4">
                    {previewImages.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={img}
                          alt={`Preview ${idx}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Messages */}
          {msg && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-lg">
              ✓ {msg}
            </div>
          )}
          {err && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
              ✕ {err}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || uploading}
            className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ Creating property...' : uploading ? '📤 Uploading images...' : '✓ Create Property'}
          </button>
        </form>
      </div>
    </div>
  )
}
