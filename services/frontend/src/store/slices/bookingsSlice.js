import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api, ownerApi } from '../../api';

const requireAuth = (auth, rejectWithValue) => {
  if (!auth?.token) {
    return rejectWithValue('You must be signed in to perform this action');
  }
  return null;
};

// Async thunks
export const fetchBookings = createAsyncThunk(
  'bookings/fetchBookings',
  async (_, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      const authError = requireAuth(auth, rejectWithValue);
      if (authError) return authError;

      const { data } = await api.get('/api/bookings');
      return data.bookings;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch bookings');
    }
  }
);

// Fetch owner bookings
export const fetchOwnerBookings = createAsyncThunk(
  'bookings/fetchOwnerBookings',
  async (_, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      const authError = requireAuth(auth, rejectWithValue);
      if (authError) return authError;

      const { data } = await ownerApi.get('/api/bookings');
      return data.bookings;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch owner bookings');
    }
  }
);

// Accept booking (owner)
export const acceptBooking = createAsyncThunk(
  'bookings/acceptBooking',
  async (bookingId, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      const authError = requireAuth(auth, rejectWithValue);
      if (authError) return authError;

      const { data } = await ownerApi.put(`/api/bookings/${bookingId}/accept`, {});
      return data.booking;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to accept booking');
    }
  }
);

// Cancel booking (owner)
export const rejectBooking = createAsyncThunk(
  'bookings/rejectBooking',
  async (bookingId, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      const authError = requireAuth(auth, rejectWithValue);
      if (authError) return authError;

      const { data } = await ownerApi.put(`/api/bookings/${bookingId}/cancel`, {});
      return data.booking;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to cancel booking');
    }
  }
);

export const createBooking = createAsyncThunk(
  'bookings/createBooking',
  async (bookingData, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      const authError = requireAuth(auth, rejectWithValue);
      if (authError) return authError;

      const { data } = await api.post('/api/bookings', bookingData);
      return data.booking;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to create booking');
    }
  }
);

export const cancelBooking = createAsyncThunk(
  'bookings/cancelBooking',
  async (bookingId, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      const authError = requireAuth(auth, rejectWithValue);
      if (authError) return authError;

      const { data } = await api.put(`/api/bookings/${bookingId}/cancel`, {});
      return data.booking;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to cancel booking');
    }
  }
);

const bookingsSlice = createSlice({
  name: 'bookings',
  initialState: {
    travelerItems: [],
    ownerItems: [],
    loading: false,
    error: null,
    createSuccess: false,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCreateSuccess: (state) => {
      state.createSuccess = false;
    },
    updateBookingStatus: (state, action) => {
      // Update booking status when Kafka message received
      const { bookingId, status } = action.payload;
      ['travelerItems', 'ownerItems'].forEach((listKey) => {
        const booking = state[listKey].find(b => b._id === bookingId);
        if (booking) {
          booking.status = status;
          booking.updatedAt = new Date().toISOString();
        }
      });
    },
  },
  extraReducers: (builder) => {
    // Fetch bookings
    builder
      .addCase(fetchBookings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBookings.fulfilled, (state, action) => {
        state.loading = false;
        state.travelerItems = action.payload;
      })
      .addCase(fetchBookings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Create booking
    builder
      .addCase(createBooking.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.createSuccess = false;
      })
      .addCase(createBooking.fulfilled, (state, action) => {
        state.loading = false;
        state.travelerItems.unshift(action.payload);
        state.createSuccess = true;
      })
      .addCase(createBooking.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.createSuccess = false;
      });

    // Cancel booking
    builder
      .addCase(cancelBooking.fulfilled, (state, action) => {
        state.travelerItems = state.travelerItems.map(b => b._id === action.payload._id ? action.payload : b);
      });

    // Fetch owner bookings
    builder
      .addCase(fetchOwnerBookings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOwnerBookings.fulfilled, (state, action) => {
        state.loading = false;
        state.ownerItems = action.payload;
      })
      .addCase(fetchOwnerBookings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Accept booking (owner)
    builder
      .addCase(acceptBooking.fulfilled, (state, action) => {
        state.ownerItems = state.ownerItems.map(b => b._id === action.payload._id ? action.payload : b);
      })
      .addCase(acceptBooking.rejected, (state, action) => {
        state.error = action.payload;
      });

    // Reject booking (owner)
    builder
      .addCase(rejectBooking.fulfilled, (state, action) => {
        state.ownerItems = state.ownerItems.map(b => b._id === action.payload._id ? action.payload : b);
      })
      .addCase(rejectBooking.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const { clearError, clearCreateSuccess, updateBookingStatus } = bookingsSlice.actions;
export default bookingsSlice.reducer;
