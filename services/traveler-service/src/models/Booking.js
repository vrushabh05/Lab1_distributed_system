import { mongoose } from '../../shared/core/database.js';

const bookingSchema = new mongoose.Schema({
  travelerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    index: true, // Index for faster queries by traveler
  },
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true, // Index for faster queries by property
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true, // Index for faster queries by owner
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  totalPrice: { type: Number, required: true },
  pricePerNight: { type: Number },
  guests: { type: Number, default: 1 },
  title: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String },
  comments: { type: String },
  status: {
    type: String,
    enum: ['PENDING', 'ACCEPTED', 'CANCELLED', 'COMPLETED'],
    default: 'PENDING'
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

bookingSchema.index({ travelerId: 1, status: 1 });
bookingSchema.index({ propertyId: 1, startDate: 1, endDate: 1 });
bookingSchema.index({ travelerId: 1, createdAt: -1 });
bookingSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Booking', bookingSchema);
