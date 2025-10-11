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

const letterSchema = mongoose.Schema(
    {
        type: { type: String, required: true },
        reason: { type: String, required: true },
        date: { type: Date, required: true },
        studentId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
        student: { type: String, required: true }, // Student's name for display
        status: { type: String, required: true, default: 'Submitted' },
        currentStageIndex: { type: Number, required: true, default: 0 },
        submittedDate: { type: Date, default: Date.now },
        attachments: { type: String }, // Path to uploaded file if any

        // --- OPTIONAL FIELDS FOR MEDICAL CERTIFICATE (EXCUSE REQUEST) TYPE LETTERS ---
        regNo: { type: String }, // Registration Number
        mobile: { type: String },
        email: { type: String },
        address: { type: String },
        levelOfStudy: { type: String },
        subjectCombo: { type: String },
        absences: [ // Array of objects for periods of absence
            {
                courseCode: { type: String },
                date: { type: String }, // Or Date type if you parse it
            },
        ],
        reasonDetails: { type: String }, // Detailed reason from excuse form
        lectureAbsents: { type: String }, // Number of lectures/practicals missed
        // medicalFormPath: { type: String }, // This will now be stored in the 'attachments' field

        // Keep this for backward compatibility if old medical certificates linked to separate ExcuseRequests
        excuseRequestId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ExcuseRequest',
          default: null
        },
        // --- END OPTIONAL FIELDS ---

        // --- NEW APPROVALS ARRAY ---
        approvals: [approvalStageSchema],
        lastUpdated: { type: Date }, // To track when the status was last updated
    },
    {
        timestamps: true, // Automatically add createdAt and updatedAt timestamps
    }
);

const Letter = mongoose.model('Letter', letterSchema);

export default Letter;
