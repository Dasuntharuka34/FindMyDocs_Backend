import mongoose from 'mongoose';

const requestTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    type: {
        type: String,
        required: true,
        enum: ['Excuse', 'Leave', 'Letter']
    },
    subject: {
        type: String,
        requred: false // Mostly for Letters
    },
    body: {
        type: String, // Can contain HTML or Markdown
        required: true
    },
    placeholders: [{
        type: String
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

const RequestTemplate = mongoose.model('RequestTemplate', requestTemplateSchema);

export default RequestTemplate;
