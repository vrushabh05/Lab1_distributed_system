import React, { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { updateProperty } from '../store/slices/propertiesSlice'

export default function EditPropertyModal({ property, onClose }) {
    const dispatch = useDispatch()
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        pricePerNight: '',
        address: '',
        city: '',
        state: '',
        country: '',
        bedrooms: 1,
        bathrooms: 1,
        maxGuests: 1,
        amenities: [],
        type: 'Apartment'
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (property) {
            setFormData({
                title: property.title || '',
                description: property.description || '',
                pricePerNight: property.pricePerNight || '',
                address: property.address || '',
                city: property.city || '',
                state: property.state || '',
                country: property.country || '',
                bedrooms: property.bedrooms || 1,
                bathrooms: property.bathrooms || 1,
                maxGuests: property.maxGuests || 1,
                amenities: property.amenities || [],
                type: property.type || 'Apartment'
            })
        }
    }, [property])

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleAmenityChange = (e) => {
        const amenity = e.target.value
        if (e.target.checked) {
            setFormData(prev => ({ ...prev, amenities: [...prev.amenities, amenity] }))
        } else {
            setFormData(prev => ({ ...prev, amenities: prev.amenities.filter(a => a !== amenity) }))
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const result = await dispatch(updateProperty({
                id: property._id || property.id,
                data: formData
            }))

            if (updateProperty.fulfilled.match(result)) {
                onClose()
            } else {
                setError(result.payload || 'Failed to update property')
            }
        } catch (err) {
            setError(err.message || 'An error occurred')
        } finally {
            setLoading(false)
        }
    }

    const AMENITIES_LIST = [
        'Wifi', 'Kitchen', 'Washer', 'Dryer', 'Air conditioning',
        'Heating', 'TV', 'Iron', 'Pool', 'Hot tub',
        'Free parking', 'Gym', 'Breakfast', 'Fireplace'
    ]

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
                    <h2 className="text-2xl font-bold text-gray-900">Edit Property</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                className="input w-full"
                                required
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                className="input w-full h-32"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Price per Night ($)</label>
                            <input
                                type="number"
                                name="pricePerNight"
                                value={formData.pricePerNight}
                                onChange={handleChange}
                                className="input w-full"
                                min="0"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                            <select
                                name="type"
                                value={formData.type}
                                onChange={handleChange}
                                className="input w-full"
                            >
                                <option value="Apartment">Apartment</option>
                                <option value="House">House</option>
                                <option value="Villa">Villa</option>
                                <option value="Cabin">Cabin</option>
                                <option value="Loft">Loft</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                            <input
                                type="text"
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                                className="input w-full"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                            <input
                                type="text"
                                name="country"
                                value={formData.country}
                                onChange={handleChange}
                                className="input w-full"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4 col-span-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Bedrooms</label>
                                <input
                                    type="number"
                                    name="bedrooms"
                                    value={formData.bedrooms}
                                    onChange={handleChange}
                                    className="input w-full"
                                    min="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Bathrooms</label>
                                <input
                                    type="number"
                                    name="bathrooms"
                                    value={formData.bathrooms}
                                    onChange={handleChange}
                                    className="input w-full"
                                    min="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Max Guests</label>
                                <input
                                    type="number"
                                    name="maxGuests"
                                    value={formData.maxGuests}
                                    onChange={handleChange}
                                    className="input w-full"
                                    min="1"
                                />
                            </div>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Amenities</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {AMENITIES_LIST.map(amenity => (
                                    <label key={amenity} className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            value={amenity}
                                            checked={formData.amenities.includes(amenity)}
                                            onChange={handleAmenityChange}
                                            className="rounded text-rose-500 focus:ring-rose-500"
                                        />
                                        <span className="text-sm text-gray-700">{amenity}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-lg hover:shadow-lg transition font-medium disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
