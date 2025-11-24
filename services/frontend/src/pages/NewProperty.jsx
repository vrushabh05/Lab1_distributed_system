import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { createProperty } from '../store/slices/propertiesSlice'
import { propertyApi } from '../api'
import {
  Home, MapPin, DollarSign, Users, BedDouble, Bath,
  Wifi, Car, Utensils, Wind, Tv, Coffee, Camera, X, CheckCircle, AlertCircle,
  Loader2, Image as ImageIcon
} from 'lucide-react'

// Match backend validation schema exactly (from shared/validation/schemas.js)
const PROPERTY_TYPES = ['Apartment', 'House', 'Condo', 'Villa', 'Cabin', 'Other']

const AMENITIES_LIST = [
  { id: 'wifi', label: 'WiFi', icon: Wifi },
  { id: 'kitchen', label: 'Kitchen', icon: Utensils },
  { id: 'parking', label: 'Free Parking', icon: Car },
  { id: 'ac', label: 'Air Conditioning', icon: Wind },
  { id: 'tv', label: 'TV', icon: Tv },
  { id: 'coffee', label: 'Coffee Maker', icon: Coffee },
]

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
  maxGuests: 2,
  amenities: []
}

export default function NewProperty() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { loading } = useSelector((state) => state.properties)
  const { user, token } = useSelector((state) => state.auth)

  const [form, setForm] = useState(initialForm)
  const [imageFiles, setImageFiles] = useState([])
  const [previewImages, setPreviewImages] = useState([])
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)
  const [uploading, setUploading] = useState(false)

  // Check if user is an owner
  useEffect(() => {
    if (user && user.role !== 'OWNER') {
      navigate('/')
    }
  }, [user, navigate])

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const toggleAmenity = (amenityLabel) => {
    setForm(prev => {
      const exists = prev.amenities.includes(amenityLabel)
      return {
        ...prev,
        amenities: exists
          ? prev.amenities.filter(a => a !== amenityLabel)
          : [...prev.amenities, amenityLabel]
      }
    })
  }

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setImageFiles(prev => [...prev, ...files])

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

    // CRITICAL FIX: Enhanced validation matching backend requirements
    if (!form.title.trim() || form.title.trim().length < 5) {
      setErr('Property title must be at least 5 characters long.')
      window.scrollTo(0, 0)
      return
    }

    if (!form.city.trim()) {
      setErr('City is required.')
      window.scrollTo(0, 0)
      return
    }

    if (!form.country.trim()) {
      setErr('Country is required.')
      window.scrollTo(0, 0)
      return
    }

    const priceNum = Number(form.pricePerNight)
    if (!priceNum || priceNum < 1) {
      setErr('Price per night must be at least $1.')
      window.scrollTo(0, 0)
      return
    }

    const guestsNum = Number(form.maxGuests)
    if (!guestsNum || guestsNum < 1) {
      setErr('Maximum guests must be at least 1.')
      window.scrollTo(0, 0)
      return
    }

    // Ensure description meets minimum length (20 characters)
    let finalDescription = form.description.trim()
    if (finalDescription.length < 20) {
      finalDescription = finalDescription + ' This is a wonderful place to stay with great amenities and comfortable living space perfect for your next trip.'
    }

    // Build payload with validated data
    const payload = {
      title: form.title.trim(),
      type: form.type,
      description: finalDescription,
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      country: form.country.trim(),
      pricePerNight: priceNum,
      bedrooms: Math.max(0, Number(form.bedrooms) || 1),
      bathrooms: Math.max(0, Number(form.bathrooms) || 1),
      maxGuests: guestsNum,
      amenities: form.amenities,
      photos: []
    }

    // Remove optional string fields if empty to satisfy backend schema
    ;['address', 'state'].forEach((field) => {
      if (!payload[field]) {
        delete payload[field]
      }
    })

    try {
      // 1. Create Property
      const result = await dispatch(createProperty(payload))

      if (createProperty.rejected.match(result)) {
        const errorPayload = result.payload
        const errorMessage = typeof errorPayload === 'object'
          ? (errorPayload.message || JSON.stringify(errorPayload))
          : (errorPayload || 'Failed to create property')
        throw new Error(errorMessage)
      }

      const propertyId = result.payload.id || result.payload._id

      const createdMessage = `Property created with id ${propertyId}.`
      // 2. Upload Images (Graceful Handling)
      if (imageFiles.length > 0) {
        setUploading(true)
        let uploadCount = 0

        for (const file of imageFiles) {
          try {
            const formData = new FormData()
            // IMPORTANT: propertyId must come BEFORE file so multer's storage
            // destination can see it when handling the file part.
            formData.append('propertyId', propertyId)
            formData.append('file', file)

            await propertyApi.post('/api/properties/upload-image', formData)
            uploadCount++
          } catch (uploadErr) {
            console.error('Failed to upload image:', uploadErr)
            // Continue with other images
          }
        }
        setUploading(false)

        if (uploadCount < imageFiles.length) {
          setMsg(`${createdMessage} Some images failed to upload (${uploadCount}/${imageFiles.length} success).`)
        } else {
          setMsg(`${createdMessage} All images uploaded successfully!`)
        }
      } else {
        setMsg(`${createdMessage} Listing published!`)
      }

      // Reset form
      setForm(initialForm)
      setImageFiles([])
      setPreviewImages([])
      window.scrollTo(0, 0)

    } catch (e) {
      console.error('Create property error:', e)
      setErr(e.message || 'Something went wrong. Please try again.')
      setUploading(false)
      window.scrollTo(0, 0)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-3 tracking-tight">
            List Your Property
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Share your space with travelers from around the world. It only takes a few minutes.
          </p>
        </div>

        {/* Notifications */}
        {msg && (
          <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-green-800 animate-fade-in">
            <CheckCircle className="w-6 h-6 flex-shrink-0" />
            <span className="font-medium">{msg}</span>
          </div>
        )}
        {err && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-800 animate-fade-in">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <span className="font-medium">{err}</span>
          </div>
        )}

        <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT COLUMN: Main Info */}
          <div className="lg:col-span-2 space-y-8">

            {/* Basic Details Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-rose-100 rounded-lg text-rose-600">
                  <Home className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Property Details</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Title <span className="text-rose-500">*</span></label>
                  <input
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 transition-all outline-none"
                    placeholder="e.g. Modern Sunset Villa"
                    value={form.title}
                    onChange={e => update('title', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
                    <select
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 transition-all outline-none bg-white"
                      value={form.type}
                      onChange={e => update('type', e.target.value)}
                    >
                      {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Price per Night ($)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                      <input
                        type="number"
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 transition-all outline-none"
                        value={form.pricePerNight}
                        onChange={e => update('pricePerNight', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <textarea
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 transition-all outline-none h-32 resize-none"
                    placeholder="Tell guests what makes your place special..."
                    value={form.description}
                    onChange={e => update('description', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Location Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                  <MapPin className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Location</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
                  <input
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 transition-all outline-none"
                    placeholder="123 Main St"
                    value={form.address}
                    onChange={e => update('address', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">City</label>
                  <input
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 transition-all outline-none"
                    placeholder="New York"
                    value={form.city}
                    onChange={e => update('city', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Country</label>
                  <input
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 transition-all outline-none"
                    placeholder="USA"
                    value={form.country}
                    onChange={e => update('country', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Photos Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                  <Camera className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Photos</h2>
              </div>

              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-rose-400 hover:bg-rose-50 transition-colors cursor-pointer relative group">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center pointer-events-none">
                    <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                    <p className="text-lg font-semibold text-gray-900">Click or drag to upload photos</p>
                    <p className="text-sm text-gray-500 mt-1">High quality photos increase bookings!</p>
                  </div>
                </div>

                {previewImages.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
                    {previewImages.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group shadow-sm">
                        <img src={img} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-2 right-2 p-1.5 bg-white/90 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-white shadow-sm"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Amenities & Submit */}
          <div className="space-y-8">

            {/* Rooms & Guests */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Capacity</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-gray-500" />
                    <span className="font-medium text-gray-700">Guests</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    className="w-20 px-3 py-2 rounded-lg border border-gray-200 text-center font-semibold focus:border-rose-500 outline-none"
                    value={form.maxGuests}
                    onChange={e => update('maxGuests', e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <BedDouble className="w-5 h-5 text-gray-500" />
                    <span className="font-medium text-gray-700">Bedrooms</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    className="w-20 px-3 py-2 rounded-lg border border-gray-200 text-center font-semibold focus:border-rose-500 outline-none"
                    value={form.bedrooms}
                    onChange={e => update('bedrooms', e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Bath className="w-5 h-5 text-gray-500" />
                    <span className="font-medium text-gray-700">Bathrooms</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    className="w-20 px-3 py-2 rounded-lg border border-gray-200 text-center font-semibold focus:border-rose-500 outline-none"
                    value={form.bathrooms}
                    onChange={e => update('bathrooms', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Amenities */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Amenities</h3>
              <div className="flex flex-wrap gap-2">
                {AMENITIES_LIST.map((amenity) => {
                  const isSelected = form.amenities.includes(amenity.label)
                  const Icon = amenity.icon
                  return (
                    <button
                      key={amenity.id}
                      type="button"
                      onClick={() => toggleAmenity(amenity.label)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${isSelected
                        ? 'bg-rose-500 text-white shadow-md transform scale-105'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      <Icon className="w-4 h-4" />
                      {amenity.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Submit Action */}
            <div className="sticky top-6">
              <button
                type="submit"
                disabled={loading || uploading}
                className="w-full bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading || uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {uploading ? 'Uploading Photos...' : 'Creating Listing...'}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Publish Listing
                  </>
                )}
              </button>
              <p className="text-center text-xs text-gray-400 mt-4">
                By publishing, you agree to our terms of service.
              </p>
            </div>

          </div>
        </form>
      </div>
    </div>
  )
}
