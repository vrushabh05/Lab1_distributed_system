import React, { useState, useEffect, useRef } from 'react'

/**
 * Optimized Image Component with:
 * - Lazy loading with Intersection Observer
 * - Low quality placeholder
 * - Async decoding
 * - Loading states
 */
export default function OptimizedImage({ 
  src, 
  alt = '', 
  className = '',
  priority = false,
  aspectRatio = '16/9',
  objectFit = 'cover',
  placeholderColor = '#f3f4f6'
}) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(priority)
  const imgRef = useRef(null)

  useEffect(() => {
    // Priority images load immediately
    if (priority) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observer.unobserve(entry.target)
          }
        })
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.01
      }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current)
      }
    }
  }, [priority])

  // Generate low quality placeholder URL
  const getPlaceholderUrl = (url) => {
    if (url.includes('unsplash.com')) {
      // Use Unsplash's built-in placeholder/blur
      return url.replace(/w=\d+/, 'w=20').replace(/q=\d+/, 'q=20')
    }
    return url
  }

  const placeholderUrl = getPlaceholderUrl(src)
  const shouldShowImage = isInView || priority

  return (
    <div 
      ref={imgRef}
      className={`relative overflow-hidden ${className}`}
      style={{ 
        aspectRatio,
        backgroundColor: placeholderColor
      }}
    >
      {/* Low quality placeholder - loads immediately */}
      {shouldShowImage && (
        <img
          src={placeholderUrl}
          alt=""
          className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${
            isLoaded ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ 
            objectFit,
            filter: 'blur(10px)',
            transform: 'scale(1.1)' // Slightly scale to hide blur edges
          }}
          aria-hidden="true"
        />
      )}

      {/* Full quality image - loads when in view */}
      {shouldShowImage && (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ objectFit }}
        />
      )}

      {/* Loading state indicator */}
      {!isLoaded && shouldShowImage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
