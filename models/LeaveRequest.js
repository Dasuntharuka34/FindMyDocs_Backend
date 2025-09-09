// leave request model -->
import mongoose from 'mongoose';

// const mongoose = require('mongoose');

// Define the approval stage schema
const approvalStageSchema = mongoose.Schema({
  approverRole: {
    type: String,
    enum: ['Lecturer', 'HOD', 'Dean', 'VC'],
    required: true
  },
  approverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approverName: {
    type: String // Add this field
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  comment: {
    type: String,
    default: ''
  },
  approvedAt: {
    type: Date
  }
});

// Define the main LeaveRequest schema
const leaveRequestSchema = mongoose.Schema({
  studentId: {
    type: String,
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  reasonDetails: {
    type: String,
    required: true,
  },
  contactDuringLeave: {
    type: String,
  },
  remarks: {
    type: String,
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  attachments: {
    type: String // You can store the file path or URL here
  },
  status: {
    type: String,
    enum: ['Submitted', 'Pending Lecturer Approval', 'Pending HOD Approval', 'Pending Dean Approval', 'Pending VC Approval', 'Approved', 'Rejected'],
    default: 'Submitted'
  },
  submittedDate: {
      type: Date,
      default: Date.now,
    },
  approvals: [approvalStageSchema], // Array to track each approval stage
  submittedAt: {
    type: Date,
    default: Date.now
  },
  currentStageIndex: {
    type: Number,
    required: true,
  }
});

const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);

export default LeaveRequest;
