import express from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import Favorite from '../models/Favorite.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required for traveler-service favorites routes');
}
const PROPERTY_SERVICE_URL = process.env.PROPERTY_SERVICE_URL || 'http://property-service:3003';

// Middleware to verify JWT
const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Get all favorites for user
router.get('/', authMiddleware, async (req, res) => {
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
router.post('/', authMiddleware, async (req, res) => {
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
router.delete('/:propertyId', authMiddleware, async (req, res) => {
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
