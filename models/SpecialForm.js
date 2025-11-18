import mongoose from 'mongoose';

const specialFormSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  isEnabled: {
    type: Boolean,
    default: true,
  },
});

const SpecialForm = mongoose.model('SpecialForm', specialFormSchema);

export default SpecialForm;