import { mongoose } from '../../shared/core/database.js';

const bookingSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  travelerId: { type: String, required: true },
  propertyId: { type: String, required: true },
  ownerId: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  totalPrice: { type: Number, required: true },
  pricePerNight: { type: Number },
  guests: { type: Number, default: 1 },
  title: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String },
  status: { 
    type: String, 
    enum: ['PENDING', 'ACCEPTED', 'CANCELLED', 'COMPLETED'], 
    default: 'PENDING' 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

bookingSchema.index({ ownerId: 1, status: 1 });
bookingSchema.index({ ownerId: 1, createdAt: -1 });
bookingSchema.index({ propertyId: 1, status: 1 });
bookingSchema.index({ status: 1, updatedAt: -1 });

export default mongoose.model('Booking', bookingSchema);
