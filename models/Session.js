import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    token: {
        type: String,
        required: true,
        unique: true,
    },
    ipAddress: {
        type: String,
    },
    userAgent: {
        type: String,
    },
    deviceType: {
        type: String,
        enum: ['WEB', 'MOBILE', 'TABLET', 'UNKNOWN'],
        default: 'UNKNOWN',
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    lastActivity: {
        type: Date,
        default: Date.now,
    },
    expiresAt: {
        type: Date,
        required: true,
    },
}, {
    timestamps: true,
});

// Index for efficient querying
sessionSchema.index({ userId: 1, isActive: 1 });
sessionSchema.index({ token: 1 });
sessionSchema.index({ expiresAt: 1 });

// Auto-delete expired sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Session = mongoose.model('Session', sessionSchema);

export default Session;
