import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

const getFavoritePropertyId = (favorite) => {
  if (!favorite) return '';
  const property = favorite.property || {};
  return String(
    favorite.propertyId ||
    property._id ||
    favorite._id ||
    favorite.id ||
    ''
  );
};

// Async thunks
export const fetchFavorites = createAsyncThunk(
  'favorites/fetchFavorites',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/api/favorites');
      return response.data.favorites;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch favorites');
    }
  }
);

export const addFavorite = createAsyncThunk(
  'favorites/addFavorite',
  async (propertyId, { rejectWithValue }) => {
    try {
      const response = await api.post('/api/favorites', { propertyId });
      return response.data.favorite;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to add favorite');
    }
  }
);

export const removeFavorite = createAsyncThunk(
  'favorites/removeFavorite',
  async (propertyId, { rejectWithValue }) => {
    try {
      await api.delete(`/api/favorites/${propertyId}`);
      return propertyId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to remove favorite');
    }
  }
);

const favoritesSlice = createSlice({
  name: 'favorites',
  initialState: {
    items: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch favorites
    builder
      .addCase(fetchFavorites.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFavorites.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchFavorites.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Add favorite
    builder
      .addCase(addFavorite.fulfilled, (state, action) => {
          const newId = getFavoritePropertyId(action.payload);
          const exists = state.items.some(f => getFavoritePropertyId(f) === newId);
          if (!exists) {
            state.items.push(action.payload);
          }
      });

    // Remove favorite
    builder
      .addCase(removeFavorite.fulfilled, (state, action) => {
        state.items = state.items.filter(
          (favorite) => getFavoritePropertyId(favorite) !== String(action.payload)
        );
      });
  },
});

export const { clearError } = favoritesSlice.actions;
export default favoritesSlice.reducer;
