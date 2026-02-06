import mongoose from 'mongoose';

const scheduledReportSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    reportType: {
        type: String,
        required: true,
        enum: ['users', 'formSubmissions', 'leaveRequests', 'excuseRequests', 'all', 'custom'],
    },
    configuration: {
        model: String,
        fields: [String],
        filters: mongoose.Schema.Types.Mixed,
    },
    frequency: {
        type: String,
        required: true,
        enum: ['daily', 'weekly', 'monthly'],
    },
    recipients: {
        type: [String],
        required: true,
    },
    lastRun: {
        type: Date,
    },
    nextRun: {
        type: Date,
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    format: {
        type: String,
        enum: ['csv', 'json'],
        default: 'csv',
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }
}, {
    timestamps: true,
});

const ScheduledReport = mongoose.model('ScheduledReport', scheduledReportSchema);

export default ScheduledReport;
