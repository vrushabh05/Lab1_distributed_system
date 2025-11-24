import { mongoose } from '../../../shared/core/database.js';

const bookingSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  travelerId: { type: String, required: false }, // Optional for placeholder records
  propertyId: { type: String, required: false }, // Optional for placeholder records
  ownerId: { type: String, required: false }, // Optional for placeholder records
  startDate: { type: Date, required: false }, // Optional for placeholder records
  endDate: { type: Date, required: false }, // Optional for placeholder records
  totalPrice: { type: Number, required: false }, // Optional for placeholder records
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
  // Internal flag to track placeholder records created from out-of-order messages
  _placeholder: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

bookingSchema.index({ travelerId: 1, status: 1 });
bookingSchema.index({ propertyId: 1, startDate: 1, endDate: 1 });
bookingSchema.index({ propertyId: 1, status: 1, startDate: 1 });
bookingSchema.index({ ownerId: 1, status: 1 });
bookingSchema.index({ status: 1, endDate: 1 }); // For auto-completion

export default mongoose.model('Booking', bookingSchema);
