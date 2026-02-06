import mongoose from 'mongoose';

const archivedRequestSchema = new mongoose.Schema({
    originalId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    originalCollection: {
        type: String,
        required: true, // 'ExcuseRequest', 'LeaveRequest', 'Letter'
    },
    data: {
        type: mongoose.Schema.Types.Mixed, // Stores the entire original document
        required: true
    },
    archivedAt: {
        type: Date,
        default: Date.now
    },
    archivedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

const ArchivedRequest = mongoose.model('ArchivedRequest', archivedRequestSchema);

export default ArchivedRequest;
