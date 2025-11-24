import { mongoose } from '../../../shared/core/database.js';

const reviewSchema = new mongoose.Schema({
  propertyId: { type: String, required: true, index: true },
  travelerId: { type: String, required: true },
  bookingId: { type: String, required: true, unique: true },
  travelerName: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, maxlength: 2000 },
  stayStart: { type: Date },
  stayEnd: { type: Date },
  publishedAt: { type: Date, default: Date.now },
}, {
  timestamps: true
});

reviewSchema.index({ propertyId: 1, travelerId: 1 }, { unique: true });

export default mongoose.model('Review', reviewSchema);

