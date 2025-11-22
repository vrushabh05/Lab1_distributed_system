import { mongoose } from '../../shared/core/database.js';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['TRAVELER', 'OWNER'], required: true },
  phone: String,
  city: String,
  country: String,
  avatar: String,
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('User', userSchema);
