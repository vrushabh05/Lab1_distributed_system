import express from 'express';
import axios from 'axios';
import Favorite from '../models/Favorite.js';
import { createAuthMiddleware } from '../../../shared/core/index.js';

const router = express.Router();
const PROPERTY_SERVICE_URL = process.env.PROPERTY_SERVICE_URL || 'http://property-service:3003';

const requireTraveler = createAuthMiddleware({ roles: ['TRAVELER'] });

// Get all favorites for user
router.get('/', requireTraveler, async (req, res) => {
  try {
    const favorites = await Favorite.find({ userId: req.user.id });
    const withProperties = await Promise.all(
      favorites.map(async (fav) => {
        try {
          const { data } = await axios.get(`${PROPERTY_SERVICE_URL}/api/properties/${fav.propertyId}`);
          return {
            ...fav.toObject(),
            property: data.property || null,
          };
        } catch (err) {
          console.warn(`Failed to load property ${fav.propertyId} for favorite`, err?.message || err);
          return fav.toObject();
        }
      })
    );
    res.json({ favorites: withProperties });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// Add favorite
router.post('/', requireTraveler, async (req, res) => {
  try {
    const { propertyId } = req.body;
    
    const favorite = new Favorite({
      userId: req.user.id,
      propertyId,
    });
    
    await favorite.save();
    res.json({ message: 'Added to favorites', favorite });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Already in favorites' });
    }
    console.error('Add favorite error:', error);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

// Remove favorite
router.delete('/:propertyId', requireTraveler, async (req, res) => {
  try {
    const { propertyId } = req.params;
    
    const result = await Favorite.deleteOne({
      userId: req.user.id,
      propertyId,
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Favorite not found' });
    }
    
    res.json({ message: 'Removed from favorites' });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

export default router;
