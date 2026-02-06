import mongoose from 'mongoose';

const emailTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    subject: {
        type: String,
        required: true,
    },
    htmlContent: {
        type: String,
        required: true,
    },
    textContent: {
        type: String,
    },
    variables: [{
        name: String,
        description: String,
        example: String,
    }],
    category: {
        type: String,
        enum: ['REGISTRATION', 'APPROVAL', 'REJECTION', 'NOTIFICATION', 'ANNOUNCEMENT', 'CUSTOM'],
        default: 'CUSTOM',
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    isDefault: {
        type: Boolean,
        default: false,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
});

// Index for efficient querying
emailTemplateSchema.index({ category: 1, isActive: 1 });
emailTemplateSchema.index({ name: 1 });

const EmailTemplate = mongoose.model('EmailTemplate', emailTemplateSchema);

export default EmailTemplate;
