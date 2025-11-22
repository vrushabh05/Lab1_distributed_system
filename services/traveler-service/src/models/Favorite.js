import { mongoose } from '../../shared/core/database.js';

const favoriteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  propertyId: { type: String, required: true }, // Reference to property service
  createdAt: { type: Date, default: Date.now },
});

favoriteSchema.index({ userId: 1, propertyId: 1 }, { unique: true });

export default mongoose.model('Favorite', favoriteSchema);
