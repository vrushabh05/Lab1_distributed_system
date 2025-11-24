import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { api } from '../../api.js';

const API_URL = import.meta.env.VITE_TRAVELER_API_URL || 'http://localhost:3001';

// ============================================================================
// TOKEN VALIDATION HELPER (Prevents "Session Zombie" state)
// ============================================================================

/**
 * Validates JWT token expiry without external library
 * @param {string} token - JWT token to validate
 * @returns {boolean} - true if token is valid and not expired
 */
const isTokenValid = (token) => {
  if (!token || typeof token !== 'string') {
    return false;
  }

  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('⚠️ Invalid JWT format (not 3 parts)');
      return false;
    }

    // Decode payload (base64url -> JSON)
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    // Check expiry (exp is in seconds, Date.now() is in milliseconds)
    if (!payload.exp) {
      console.warn('⚠️ JWT missing exp field');
      return false;
    }

    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    const isExpired = payload.exp < now;

    if (isExpired) {
      console.warn('⚠️ JWT token expired', {
        expired: new Date(payload.exp * 1000).toISOString(),
        now: new Date(now * 1000).toISOString()
      });
      return false;
    }

    // Token is valid and not expired
    return true;
  } catch (error) {
    console.error('❌ Error validating JWT token:', error);
    return false;
  }
};

/**
 * Gets a valid token from localStorage, or null if invalid/expired
 * SIDE EFFECT: Clears localStorage if token is invalid
 */
const getValidToken = () => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return null;
  }

  // CRITICAL FIX: Validate token before trusting it
  if (!isTokenValid(token)) {
    console.warn('🔴 Removing expired/invalid token from localStorage');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return null;
  }

  return token;
};

/**
 * Normalizes backend error payloads into human-readable strings so React components
 * can render them safely instead of crashing on complex objects.
 */
const formatApiError = (error, fallback = 'Request failed') => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;

  const baseMessage = typeof error.message === 'string' ? error.message : fallback;
  if (Array.isArray(error.details) && error.details.length) {
    const detailMessages = error.details
      .map((detail) => detail?.message)
      .filter(Boolean)
      .join('; ');
    return detailMessages ? `${baseMessage}: ${detailMessages}` : baseMessage;
  }

  if (typeof error.code === 'string' && error.code !== 'VALIDATION_ERROR') {
    return `${error.code}: ${baseMessage}`;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return baseMessage;
  }
};

// Async thunks
export const signup = createAsyncThunk(
  'auth/signup',
  async ({ name, email, password, role }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/signup`, {
        name,
        email,
        password,
        role,
      });
      
      // Store token in localStorage
      localStorage.setItem('token', response.data.token);
      
      return response.data;
    } catch (error) {
      return rejectWithValue(
        formatApiError(error.response?.data?.error, 'Signup failed')
      );
    }
  }
);

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password,
      });
      
      // Store token in localStorage
      localStorage.setItem('token', response.data.token);
      
      return response.data;
    } catch (error) {
      return rejectWithValue(
        formatApiError(error.response?.data?.error, 'Login failed')
      );
    }
  }
);

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      const response = await axios.get(`${API_URL}/api/auth/me`, {
        headers,
      });
      
      return response.data;
    } catch (error) {
      localStorage.removeItem('token');
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch user');
    }
  }
);

// Update user profile
export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (profileData, { rejectWithValue }) => {
    try {
      const response = await api.put('/api/users/me', profileData);
      return response.data.profile;
    } catch (error) {
      return rejectWithValue(formatApiError(error.response?.data?.error, 'Failed to update profile'));
    }
  }
);

// Upload avatar
export const uploadAvatar = createAsyncThunk(
  'auth/uploadAvatar',
  async (formData, { rejectWithValue }) => {
    try {
      const response = await api.post(
        '/api/users/me/avatar',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      
      return response.data.avatar_url;
    } catch (error) {
      return rejectWithValue(formatApiError(error.response?.data?.error, 'Failed to upload avatar'));
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { getState }) => {
    const { auth } = getState();
    const baseUrl = auth.user?.role === 'OWNER'
      ? (import.meta.env.VITE_OWNER_API_URL || 'http://localhost:3002')
      : API_URL;
    try {
      await axios.post(`${baseUrl}/api/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.warn('Logout request failed', error?.message);
    }
    return true;
  }
);

const clearAuthState = (state) => {
  state.user = null;
  state.token = null;
  state.isAuthenticated = false;
  state.error = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: getValidToken(), // CRITICAL FIX: Validate token on app initialization
    loading: false,
    error: null,
    isAuthenticated: false, // Will be set to true when user is fetched
  },
  reducers: {
    logout: (state) => {
      clearAuthState(state);
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Signup
    builder
      .addCase(signup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signup.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(signup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Login
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch current user
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.loading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = action.payload;
      });

    // Update profile
    builder
      .addCase(updateProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.user = { ...state.user, ...action.payload };
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Upload avatar
    builder
      .addCase(uploadAvatar.fulfilled, (state, action) => {
        if (state.user) {
          state.user.avatar_url = action.payload;
          state.user.avatar = action.payload;
        }
      })
      .addCase(uploadAvatar.rejected, (state, action) => {
        state.error = action.payload;
      });

    builder
      .addCase(logoutUser.fulfilled, (state) => {
        clearAuthState(state);
      })
      .addCase(logoutUser.rejected, (state) => {
        clearAuthState(state);
      });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
