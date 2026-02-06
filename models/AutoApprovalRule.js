import mongoose from 'mongoose';

const autoApprovalRuleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    requestType: {
        type: String,
        required: true,
        enum: ['Excuse', 'Leave', 'Letter']
    },
    conditions: [{
        field: {
            type: String,
            required: true
        },
        operator: {
            type: String,
            required: true,
            enum: ['equals', 'notEquals', 'greaterThan', 'lessThan', 'contains']
        },
        value: {
            type: mongoose.Schema.Types.Mixed, // Can be string, number, etc.
            required: true
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    priority: {
        type: Number,
        default: 0 // Higher runs first
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

const AutoApprovalRule = mongoose.model('AutoApprovalRule', autoApprovalRuleSchema);

export default AutoApprovalRule;
