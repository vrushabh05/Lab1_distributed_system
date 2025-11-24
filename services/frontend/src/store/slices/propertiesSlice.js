import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api, propertyApi } from '../../api';

// Async thunks
export const fetchProperties = createAsyncThunk(
  'properties/fetchProperties',
  async (_, { rejectWithValue }) => {
    try {
      const response = await propertyApi.get('/api/properties');
      return response.data.properties;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch properties');
    }
  }
);

export const fetchPropertyById = createAsyncThunk(
  'properties/fetchPropertyById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await propertyApi.get(`/api/properties/${id}`);
      return response.data.property;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch property');
    }
  }
);

export const fetchPropertyReviews = createAsyncThunk(
  'properties/fetchPropertyReviews',
  async (propertyId, { rejectWithValue }) => {
    try {
      const response = await propertyApi.get(`/api/properties/${propertyId}/reviews`);
      return { propertyId, ...response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch reviews');
    }
  }
);

export const searchProperties = createAsyncThunk(
  'properties/searchProperties',
  async (filters, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams(filters).toString();
      const response = await propertyApi.get(`/api/search?${params}`);
      return response.data.properties;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Search failed');
    }
  }
);

export const createProperty = createAsyncThunk(
  'properties/createProperty',
  async (propertyData, { rejectWithValue }) => {
    try {
      const response = await propertyApi.post('/api/properties', propertyData);
      return response.data.property;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to create property');
    }
  }
);

export const updateProperty = createAsyncThunk(
  'properties/updateProperty',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await propertyApi.put(`/api/properties/${id}`, data);
      return response.data.property;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to update property');
    }
  }
);

export const deleteProperty = createAsyncThunk(
  'properties/deleteProperty',
  async (id, { rejectWithValue }) => {
    try {
      await propertyApi.delete(`/api/properties/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to delete property');
    }
  }
);

export const submitPropertyReview = createAsyncThunk(
  'properties/submitPropertyReview',
  async ({ propertyId, rating, comment, bookingId }, { rejectWithValue }) => {
    try {
      const response = await propertyApi.post(`/api/properties/${propertyId}/reviews`, {
        rating,
        comment,
        bookingId
      });
      return { propertyId, review: response.data.review };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to submit review');
    }
  }
);

const propertiesSlice = createSlice({
  name: 'properties',
  initialState: {
    items: [],
    selectedProperty: null,
    selectedReviews: [],
    reviewsStats: { ratingAverage: 0, ratingCount: 0 },
    reviewsLoading: false,
    reviewSubmitting: false,
    loading: false,
    error: null,
    searchResults: [],
    searchLoading: false,
  },
  reducers: {
    clearSelectedProperty: (state) => {
      state.selectedProperty = null;
      state.selectedReviews = [];
      state.reviewsStats = { ratingAverage: 0, ratingCount: 0 };
    },
    clearError: (state) => {
      state.error = null;
    },
    clearSearchResults: (state) => {
      state.searchResults = [];
    },
  },
  extraReducers: (builder) => {
    // Fetch all properties
    builder
      .addCase(fetchProperties.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProperties.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchProperties.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch property by ID
    builder
      .addCase(fetchPropertyById.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.selectedProperty = null;
        state.selectedReviews = [];
        state.reviewsStats = { ratingAverage: 0, ratingCount: 0 };
      })
      .addCase(fetchPropertyById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedProperty = action.payload;
      })
      .addCase(fetchPropertyById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch property reviews
    builder
      .addCase(fetchPropertyReviews.pending, (state) => {
        state.reviewsLoading = true;
      })
      .addCase(fetchPropertyReviews.fulfilled, (state, action) => {
        state.reviewsLoading = false;
        state.selectedReviews = action.payload.reviews || [];
        state.reviewsStats = action.payload.stats || { ratingAverage: 0, ratingCount: 0 };
      })
      .addCase(fetchPropertyReviews.rejected, (state, action) => {
        state.reviewsLoading = false;
        state.error = action.payload;
        state.selectedReviews = [];
      });

    // Submit property review
    builder
      .addCase(submitPropertyReview.pending, (state) => {
        state.reviewSubmitting = true;
        state.error = null;
      })
      .addCase(submitPropertyReview.fulfilled, (state, action) => {
        state.reviewSubmitting = false;
        const { propertyId, review } = action.payload;
        const currentCount = state.reviewsStats.ratingCount || 0;
        const currentTotal = (state.reviewsStats.ratingAverage || 0) * currentCount;
        const newCount = currentCount + 1;
        const newAverage = Number(((currentTotal + (review.rating || 0)) / newCount).toFixed(2));
        state.reviewsStats = { ratingAverage: newAverage, ratingCount: newCount };
        if (state.selectedProperty && (state.selectedProperty._id === propertyId || state.selectedProperty.id === propertyId)) {
          state.selectedProperty.ratingAverage = newAverage;
          state.selectedProperty.ratingCount = newCount;
        }
        state.selectedReviews = [review, ...state.selectedReviews];
      })
      .addCase(submitPropertyReview.rejected, (state, action) => {
        state.reviewSubmitting = false;
        state.error = action.payload;
      });

    // Search properties
    builder
      .addCase(searchProperties.pending, (state) => {
        state.searchLoading = true;
        state.error = null;
      })
      .addCase(searchProperties.fulfilled, (state, action) => {
        state.searchLoading = false;
        state.searchResults = action.payload;
      })
      .addCase(searchProperties.rejected, (state, action) => {
        state.searchLoading = false;
        state.error = action.payload;
      });

    // Create property
    builder
      .addCase(createProperty.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createProperty.fulfilled, (state, action) => {
        state.loading = false;
        state.items.unshift(action.payload);
      })
      .addCase(createProperty.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Update property
    builder
      .addCase(updateProperty.fulfilled, (state, action) => {
        const index = state.items.findIndex(p => p._id === action.payload._id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        state.selectedProperty = action.payload;
      });

    // Delete property
    builder
      .addCase(deleteProperty.fulfilled, (state, action) => {
        state.items = state.items.filter(p => p._id !== action.payload);
      });
  },
});

export const { clearSelectedProperty, clearError, clearSearchResults } = propertiesSlice.actions;
export default propertiesSlice.reducer;
