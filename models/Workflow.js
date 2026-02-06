import mongoose from 'mongoose';

const workflowStepSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    approverRole: {
        type: String, // Reference to Role name
        required: true
    },
    isOptional: {
        type: Boolean,
        default: false
    }
});

const workflowSchema = new mongoose.Schema({
    requestType: {
        type: String,
        required: true,
        unique: true,
        enum: ['Excuse', 'Leave', 'Letter']
    },
    description: {
        type: String
    },
    steps: [workflowStepSchema],
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

const Workflow = mongoose.model('Workflow', workflowSchema);

export default Workflow;
