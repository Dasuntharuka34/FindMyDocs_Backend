import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    userName: {
        type: String,
        required: true,
    },
    action: {
        type: String,
        required: true,
        enum: [
            'USER_CREATED',
            'USER_UPDATED',
            'USER_DELETED',
            'USER_PASSWORD_RESET',
            'USER_STATUS_CHANGED',
            'REGISTRATION_APPROVED',
            'REGISTRATION_REJECTED',
            'REQUEST_APPROVED',
            'REQUEST_REJECTED',
            'BULK_OPERATION',
            'SYSTEM_CONFIG_CHANGED',
            'EMAIL_TEMPLATE_UPDATED',
            'ROLE_UPDATED',
            'DEPARTMENT_CREATED',
            'DEPARTMENT_UPDATED',
            'DEPARTMENT_DELETED',
            'DATABASE_EXPORT',
            'DATABASE_BACKUP',
            'DATA_CLEANUP',
            'OTHER'
        ],
    },
    targetType: {
        type: String,
        enum: ['User', 'Registration', 'Request', 'System', 'Email', 'Department', 'Role', 'Database'],
    },
    targetId: {
        type: String,
    },
    targetName: {
        type: String,
    },
    changes: {
        type: mongoose.Schema.Types.Mixed,
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
    },
    ipAddress: {
        type: String,
    },
    userAgent: {
        type: String,
    },
    status: {
        type: String,
        enum: ['SUCCESS', 'FAILED', 'PARTIAL'],
        default: 'SUCCESS',
    },
    errorMessage: {
        type: String,
    },
}, {
    timestamps: true,
});

// Index for efficient querying
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });
auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
