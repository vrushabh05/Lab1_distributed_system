const PROPERTY_ASSET_BASE = import.meta.env.VITE_PROPERTY_API_URL || 'http://localhost:3003'

export const DEFAULT_PROPERTY_PLACEHOLDER = 'https://placehold.co/600x400?text=Photo+coming+soon'
const SAMPLE_FALLBACKS = [
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=90',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=90',
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=90',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=90',
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1200&q=90'
]

export const resolvePhotoUrl = (photo) => {
  if (!photo || typeof photo !== 'string') return null
  if (photo.startsWith('http')) return photo
  const normalized = photo.startsWith('/') ? photo : `/${photo}`
  return `${PROPERTY_ASSET_BASE}${normalized}`
}

export const getPropertyPhotos = (property, { minFallback = 1 } = {}) => {
  if (!property) return minFallback ? [DEFAULT_PROPERTY_PLACEHOLDER] : []

  const rawPhotos = Array.isArray(property.photos) ? property.photos : []
  const resolved = rawPhotos
    .map(resolvePhotoUrl)
    .filter(Boolean)

  if (resolved.length) {
    return resolved
  }

  if (property.isSample) {
    return SAMPLE_FALLBACKS.map(resolvePhotoUrl).filter(Boolean)
  }

  return minFallback ? [DEFAULT_PROPERTY_PLACEHOLDER] : []
}

export const getPrimaryPhoto = (property) => {
  const photos = getPropertyPhotos(property, { minFallback: 1 })
  return photos[0] || DEFAULT_PROPERTY_PLACEHOLDER
}

