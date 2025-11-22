import axios from 'axios';

const createApiInstance = (baseURL, timeout = 10000) => {
  const instance = axios.create({
    baseURL,
    timeout,
    withCredentials: true,
  });

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

// Create API instances with consistent configuration
export const api = createApiInstance(API_URLS.traveler);
export const propertyApi = createApiInstance(API_URLS.property);
export const ownerApi = createApiInstance(API_URLS.owner);
export const agentApi = createApiInstance(API_URLS.agent, 15000);
export const bookingApi = createApiInstance(API_URLS.booking);

export default api;
