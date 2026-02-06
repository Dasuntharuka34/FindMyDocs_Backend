import mongoose from 'mongoose';

const systemConfigSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    category: {
        type: String,
        required: true,
        enum: ['FEATURE_FLAGS', 'SYSTEM_SETTINGS', 'EMAIL_SETTINGS', 'SECURITY', 'GENERAL'],
    },
    description: {
        type: String,
    },
    dataType: {
        type: String,
        enum: ['string', 'number', 'boolean', 'object', 'array'],
        default: 'string',
    },
    isPublic: {
        type: Boolean,
        default: false,
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
});

// Index for efficient querying
systemConfigSchema.index({ category: 1 });

const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);

export default SystemConfig;
