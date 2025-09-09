import mongoose from 'mongoose';

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
    type: String,
    default: ''
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

// Define the main ExcuseRequest schema
const excuseRequestSchema = mongoose.Schema({
  studentId: {
    type: String,
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  regNo: {
    type: String,
    required: true
  },
  mobile: {
    type: String
  },
  email: {
    type: String
  },
  address: {
    type: String
  },
  levelOfStudy: {
    type: String
  },
  subjectCombo: {
    type: String
  },
  absences: [
    {
      courseCode: {
        type: String,
        required: true
      },
      date: {
        type: String,
        required: true
      }
    }
  ],
  reason: {
    type: String,
    required: true
  },
  reasonDetails: {
    type: String
  },
  lectureAbsents: {
    type: String
  },
  attachments: {
    type: String // File path or URL
  },
  status: {
    type: String,
    enum: ['Submitted', 'Pending Lecturer Approval', 'Pending HOD Approval', 'Pending Dean Approval', 'Pending VC Approval', 'Approved', 'Rejected'],
    default: 'Submitted'
  },
  submittedDate: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  approvals: [approvalStageSchema],
  currentStageIndex: {
    type: Number,
    required: true,
  }
});

const ExcuseRequest = mongoose.model('ExcuseRequest', excuseRequestSchema);

export default ExcuseRequest;
