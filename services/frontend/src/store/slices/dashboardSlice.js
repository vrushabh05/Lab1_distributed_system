import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { ownerApi } from '../../api';

// Async thunk to fetch owner dashboard stats
export const fetchOwnerDashboard = createAsyncThunk(
  'dashboard/fetchOwnerDashboard',
  async (_, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      if (!auth?.token) {
        return rejectWithValue('You must be signed in to view the dashboard');
      }

      const { data } = await ownerApi.get('/api/dashboard');
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch dashboard');
    }
  }
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: {
    stats: {
      pending: 0,
      accepted: 0,
      cancelled: 0,
      totalRevenue: 0,
    },
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    updateStats: (state, action) => {
      // Manual update for optimistic UI
      state.stats = { ...state.stats, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOwnerDashboard.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOwnerDashboard.fulfilled, (state, action) => {
        state.loading = false;
        state.stats = action.payload;
      })
      .addCase(fetchOwnerDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, updateStats } = dashboardSlice.actions;
export default dashboardSlice.reducer;
