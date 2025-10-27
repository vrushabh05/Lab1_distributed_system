import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:3001',
  withCredentials: true
});

export const agentApi = axios.create({
  baseURL: import.meta.env.VITE_AGENT_BASE || 'http://localhost:8000'
});

export default api;
