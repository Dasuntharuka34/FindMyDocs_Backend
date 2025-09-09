import mongoose from 'mongoose';

const registrationSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    nic: {
      type: String,
      required: true,
      unique: true,
    },
    mobile: { // Add mobile field
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
      default: 'Student',
    },
    department: {
      type: String,
    },
    indexNumber: {
      type: String,
    },
    profilePicture: { // Added profilePicture field
      type: String,
      default: null, // Default to null, or a path to a default image
    },
    status: {
      type: String,
      required: true,
      default: 'pending',
      enum: ['pending', 'approved', 'rejected'],
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Password is now hashed on client side, so no pre-save hook needed

const Registration = mongoose.model('Registration', registrationSchema);

export default Registration;
