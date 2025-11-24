import { mongoose } from '../../../shared/core/database.js';

const propertySchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, required: true },
  description: { type: String, required: true },
  address: String,
  city: { type: String, required: true },
  state: String,
  country: { type: String, required: true },
  pricePerNight: { type: Number, required: true },
  bedrooms: { type: Number, default: 1 },
  bathrooms: { type: Number, default: 1 },
  maxGuests: { type: Number, default: 1 },
  amenities: [String],
  photos: [String],
  ownerId: { type: String, required: true },
  isSample: { type: Boolean, default: false },
  ratingCount: { type: Number, default: 0 },
  ratingTotal: { type: Number, default: 0 },
  ratingAverage: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes for search performance
propertySchema.index({ city: 1, country: 1 });
propertySchema.index({ pricePerNight: 1 });
propertySchema.index({ ownerId: 1 });
propertySchema.index({ title: 'text', description: 'text', city: 'text' });

export default mongoose.model('Property', propertySchema);
