import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    permissions: [{
        type: String,
        enum: [
            'VIEW_ANALYTICS',
            'MANAGE_USERS',
            'MANAGE_SYSTEM_CONFIG',
            'MANAGE_DEPARTMENTS',
            'MANAGE_EMAIL_TEMPLATES',
            'SEND_BULK_EMAILS',
            'VIEW_EMAIL_LOGS',
            'MANAGE_DATABASE',
            'CLEANUP_DATA',
            'MANAGE_AUTO_APPROVAL',
            'MANAGE_FORMS',
            'VIEW_AUDIT_LOGS',
            'APPROVE_REGISTRATIONS'
        ]
    }],
    isSystemRole: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

const Role = mongoose.model('Role', roleSchema);

export default Role;
