import mongoose from 'mongoose';

const securityLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    userEmail: {
        type: String,
    },
    userNic: {
        type: String,
    },
    eventType: {
        type: String,
        required: true,
        enum: [
            'LOGIN_SUCCESS',
            'LOGIN_FAILED',
            'LOGOUT',
            'PASSWORD_CHANGE',
            'PASSWORD_RESET',
            'ACCOUNT_LOCKED',
            'ACCOUNT_UNLOCKED',
            'SUSPICIOUS_ACTIVITY',
            'UNAUTHORIZED_ACCESS',
            'SESSION_EXPIRED',
            'MULTIPLE_FAILED_ATTEMPTS',
            'OTHER'
        ],
    },
    ipAddress: {
        type: String,
    },
    userAgent: {
        type: String,
    },
    location: {
        type: String,
    },
    success: {
        type: Boolean,
        default: false,
    },
    reason: {
        type: String,
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
    },
}, {
    timestamps: true,
});

// Index for efficient querying
securityLogSchema.index({ userId: 1, createdAt: -1 });
securityLogSchema.index({ eventType: 1, createdAt: -1 });
securityLogSchema.index({ ipAddress: 1 });
securityLogSchema.index({ success: 1, createdAt: -1 });

const SecurityLog = mongoose.model('SecurityLog', securityLogSchema);

export default SecurityLog;
