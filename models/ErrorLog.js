import mongoose from 'mongoose';

const errorLogSchema = new mongoose.Schema({
    message: {
        type: String,
        required: true,
    },
    stack: String,
    method: String,
    url: String,
    body: mongoose.Schema.Types.Mixed,
    params: mongoose.Schema.Types.Mixed,
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    severity: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'MEDIUM',
    },
    ipAddress: String,
}, {
    timestamps: true,
});

errorLogSchema.index({ createdAt: -1 });
errorLogSchema.index({ severity: 1 });

const ErrorLog = mongoose.model('ErrorLog', errorLogSchema);

export default ErrorLog;
