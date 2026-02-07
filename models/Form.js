import mongoose from 'mongoose';

const formSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
  },
  fields: [
    {
      name: {
        type: String,
        required: true,
      },
      label: {
        type: String,
        required: true,
      },
      type: {
        type: String,
        required: true,
        enum: ['text', 'textarea', 'select', 'file', 'date', 'checkbox', 'radio'],
      },
      options: [
        {
          type: String,
        },
      ],
      validation: {
        required: {
          type: Boolean,
          default: false,
        },
      },
      logic: {
        showIf: {
          field: String,
          value: mongoose.Schema.Types.Mixed,
          operator: { type: String, enum: ['equals', 'notEquals', 'contains'] }
        }
      }
    },
  ],
  version: {
    type: Number,
    default: 1,
  },
  isArchived: {
    type: Boolean,
    default: false,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isEnabled: {
    type: Boolean,
    default: true,
  },
  isSystemForm: {
    type: Boolean,
    default: false,
  },
  visibleToRoles: {
    type: [String],
    default: [],
  },
});

const Form = mongoose.model('Form', formSchema);

export default Form;