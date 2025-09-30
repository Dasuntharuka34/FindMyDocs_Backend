
import mongoose from 'mongoose';

const formSubmissionSchema = new mongoose.Schema({
  form: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Form',
    required: true,
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  data: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    required: true,
  },
});

const FormSubmission = mongoose.model('FormSubmission', formSubmissionSchema);

export default FormSubmission;
