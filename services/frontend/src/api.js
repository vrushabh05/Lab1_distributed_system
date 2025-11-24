import axios from 'axios';

const createApiInstance = (baseURL, timeout = 10000, fallbackBaseURL) => {
  const instance = axios.create({
    baseURL,
    timeout,
    withCredentials: true,
  });

  // REQUEST INTERCEPTOR: Attach JWT token to outgoing requests
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // RESPONSE INTERCEPTOR: Handle 401 errors (SESSION ZOMBIE KILLER)
  instance.interceptors.response.use(
    (response) => {
      // Success - pass through
      return response;
    },
    async (error) => {
      const config = error.config || {};
      const isNetworkError = error.code === 'ERR_NETWORK' && !error.response;
      const canRetryWithFallback = Boolean(
        fallbackBaseURL &&
        !config.__usedFallback &&
        isNetworkError &&
        instance.defaults.baseURL !== fallbackBaseURL
      );

      if (canRetryWithFallback) {
        config.__usedFallback = true;
        config.baseURL = fallbackBaseURL;
        try {
          return await instance.request(config);
        } catch (fallbackError) {
          // If fallback also fails, continue to normal handling
          error = fallbackError;
        }
      }

      // Check for 401 Unauthorized (expired/invalid token)
      if (error.response && error.response.status === 401) {
        console.error('🔴 401 Unauthorized - Token expired or invalid. Forcing logout...');
        
        // CRITICAL FIX: Clear all auth data from localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // FORCE HARD REDIRECT to login page
        // This prevents the "Session Zombie" state where Redux thinks user is logged in
        // but all API calls fail
        window.location.href = '/login';
        
        // Optional: Show user-friendly message before redirect
        // (Note: redirect happens immediately, so this may not be visible)
        console.warn('⚠️ Your session has expired. Please log in again.');
      }
      
      // For all other errors (500, 404, network errors, etc.), pass through
      return Promise.reject(error);
    }
  );

  return instance;
};

// Centralized API URL configuration with consistent naming
const API_URLS = {
  traveler: import.meta.env.VITE_TRAVELER_API_URL || 'http://localhost:3001',
  property: import.meta.env.VITE_PROPERTY_API_URL || 'http://localhost:3003',
  owner: import.meta.env.VITE_OWNER_API_URL || 'http://localhost:3002',
  agent: import.meta.env.VITE_AGENT_API_URL || 'http://localhost:8000',
  booking: import.meta.env.VITE_BOOKING_API_URL || 'http://localhost:3004'
};

const PROPERTY_FALLBACK_URL = 'http://localhost:3003';

// Create API instances with consistent configuration
export const api = createApiInstance(API_URLS.traveler);
export const propertyApi = createApiInstance(
  API_URLS.property,
  10000,
  API_URLS.property !== PROPERTY_FALLBACK_URL ? PROPERTY_FALLBACK_URL : undefined
);
export const ownerApi = createApiInstance(API_URLS.owner);
export const agentApi = createApiInstance(API_URLS.agent, 15000);
export const bookingApi = createApiInstance(API_URLS.booking);

export default api;
