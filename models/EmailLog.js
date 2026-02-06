import mongoose from 'mongoose';

const emailLogSchema = new mongoose.Schema({
    to: {
        type: [String],
        required: true,
    },
    cc: {
        type: [String],
    },
    bcc: {
        type: [String],
    },
    subject: {
        type: String,
        required: true,
    },
    htmlContent: {
        type: String,
    },
    textContent: {
        type: String,
    },
    templateUsed: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmailTemplate',
    },
    templateName: {
        type: String,
    },
    status: {
        type: String,
        enum: ['PENDING', 'SENT', 'FAILED', 'BOUNCED'],
        default: 'PENDING',
    },
    sentBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    sentAt: {
        type: Date,
    },
    error: {
        type: String,
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
    },
}, {
    timestamps: true,
});

// Index for efficient querying
emailLogSchema.index({ status: 1, createdAt: -1 });
emailLogSchema.index({ to: 1 });
emailLogSchema.index({ sentAt: -1 });

const EmailLog = mongoose.model('EmailLog', emailLogSchema);

export default EmailLog;
