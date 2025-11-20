import Letter from '../models/Letter.js';
import User from '../models/User.js';
import { uploadToBlob } from '../config/vercelBlob.js';

// --- APPROVAL STAGE DEFINITIONS (MUST BE CONSISTENT WITH FRONTEND) ---
const approvalStages = [
    { name: "Submitted", approverRole: null },
//   { name: "Pending Staff Approval", approverRole: "Staff" },      // Index 1 (Next stage after student submission, or initial for Staff submitter if they approve their own?)
  { name: "Pending Lecturer Approval", approverRole: "Lecturer" }, // Index 2
  { name: "Pending HOD Approval", approverRole: "HOD" },    // Index 3
  { name: "Pending Dean Approval", approverRole: "Dean" },    // Index 4
  { name: "Pending VC Approval", approverRole: "VC" },      // Index 5
  { name: "Approved", approverRole: null }               // Index 6 (Final Approved state)
];

// Maps submitter roles to the initial stage index for a new letter.
const submitterRoleToInitialStageIndex = {
  "Student": 1,    // Student submits, starts at "Submitted" (needs Staff Approval next, which is index 1)
//   "Staff": 2,      // FIXED: Staff submits, skips "Submitted" and "Pending Staff Approval", starts at "Pending Lecturer Approval" (index 2)
  "Lecturer": 2,   // Lecturer submits, skips Staff, Lecturer, starts at "Pending HOD Approval" (index 3)
  "HOD": 3,        // HOD submits, skips Staff, Lecturer, HOD, starts at "Pending Dean Approval" (index 4)
  "Dean": 4,       // Dean submits, skips Staff, Lecturer, HOD, Dean, starts at "Pending VC Approval" (index 5)
  "VC": 5         // VC submits, directly goes to "Approved" (index 6)
};


// @desc    Create a new letter
// @route   POST /api/letters
// @access  Private (e.g., Student, Staff, Lecturer, HOD, Dean, VC)
const createLetter = async (req, res) => {
    const { type, reason, date, studentId, student, submitterRole } = req.body;

    // Authorization check: ensure the studentId in the request body matches the authenticated user's ID
    if (req.user._id.toString() !== studentId) {
        return res.status(403).json({ message: 'Forbidden: You are not authorized to create a letter for another user.' });
    }

    // Handle file attachment - upload to Vercel Blob if file is uploaded
    let attachmentData = null;
    if (req.file) {
      try {
        // Generate a unique filename to prevent collisions
        const filename = `${Date.now()}-${req.file.originalname}`;
        const blobUrl = await uploadToBlob(req.file.buffer, filename, {
          contentType: req.file.mimetype,
          addRandomSuffix: false // We are already generating a unique filename
        });
        attachmentData = blobUrl; // Store the URL returned by Vercel Blob
      } catch (uploadError) {
        console.error("Error uploading file to Vercel Blob:", uploadError);
        return res.status(500).json({ message: 'Failed to upload attachment', error: uploadError.message });
      }
    }

    const initialStageIndex = submitterRoleToInitialStageIndex[submitterRole] !== undefined
                               ? submitterRoleToInitialStageIndex[submitterRole]
                               : 0;
    const initialStatus = approvalStages[initialStageIndex].name;
    const firstApproverRole = approvalStages[initialStageIndex].approverRole;

    try {
        const newLetter = new Letter({
            type,
            reason,
            date,
            studentId,
            student,
            status: initialStatus,
            currentStageIndex: initialStageIndex,
            submittedDate: new Date(),
            attachments: attachmentData // Store base64 data instead of file path
        });

        if (firstApproverRole) {
            newLetter.approvals.push({
                approverRole: firstApproverRole,
                status: 'pending'
            });
        }

        const createdLetter = await newLetter.save();
        res.status(201).json(createdLetter);
    } catch (error) {
        console.error("Error creating letter:", error);
        res.status(500).json({ message: 'Server error creating letter', error: error.message });
    }
};

// @desc    Get all letters (for admin)
// @route   GET /api/letters
// @access  Private (Admin only)
const getAllLetters = async (req, res) => {
    // Authorization check: only admin can view all letters
    if (req.user.role.toLowerCase() !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: You are not authorized to view all letters.' });
    }

    try {
        const letters = await Letter.find({});
        res.json(letters);
    } catch (error) {
        console.error("Error fetching all letters:", error);
        res.status(500).json({ message: 'Server error fetching all letters', error: error.message });
    }
};

// @desc    Get letters submitted by a specific user
// @route   GET /api/letters/byUser/:userId
// @access  Private (e.g., Student, Staff, Lecturer, HOD, Dean, VC)
const getLettersByUserId = async (req, res) => {
    const { userId } = req.params;

    // Authorization check: only admin or the user themselves can view the letters
    if (req.user.role.toLowerCase() !== 'admin' && req.user._id.toString() !== userId) {
        return res.status(403).json({ message: 'Forbidden: You are not authorized to view these letters.' });
    }

    try {
        const letters = await Letter.find({ studentId: userId });
        res.json(letters);
    } catch (error) {
        console.error("Error fetching letters by user ID:", error);
        res.status(500).json({ message: 'Server error fetching letters by user ID', error: error.message });
    }
};

// @desc    Get a single letter by its ID
// @route   GET /api/letters/:id
// @access  Private (any authorized user who can view it)
const getLetterById = async (req, res) => {
    const { id } = req.params;
    try {
        const letter = await Letter.findById(id).populate('approvals.approverId', 'name email role');
        if (letter) {
            // Authorization check:
            // 1. Admin can view any letter.
            // 2. The student who created the letter can view it.
            // 3. An approver can view the letter if it's currently at their approval stage,
            //    or if they have previously interacted with this letter (approved/rejected).
            const isAdmin = req.user.role.toLowerCase() === 'admin';
            const isOwner = req.user._id.toString() === letter.studentId.toString();

            const currentApprovalStage = approvalStages[letter.currentStageIndex];
            const isCurrentApprover = currentApprovalStage && currentApprovalStage.approverRole === req.user.role;

            const hasPreviouslyInteracted = letter.approvals.some(
                (approval) => approval.approverRole === req.user.role && approval.status !== 'pending'
            );

            if (!isAdmin && !isOwner && !isCurrentApprover && !hasPreviouslyInteracted) {
                return res.status(403).json({ message: 'Forbidden: You are not authorized to view this letter.' });
            }
            res.json(letter);
        } else {
            res.status(404).json({ message: 'Letter not found' });
        }
    } catch (error) {
        console.error("Error fetching single letter by ID:", error);
        res.status(500).json({ message: 'Server error fetching letter by ID', error: error.message });
    }
};


// @desc    Get pending approvals for a specific status/role
// @route   GET /api/letters/pendingApprovals/:statusName
// @access  Private (Staff, Lecturer, HOD, Dean, VC)
const getPendingApprovals = async (req, res) => {
    const { statusName } = req.params;

    const isValidStatus = approvalStages.some(stage => stage.name === statusName);
    if (!isValidStatus) {
        return res.status(400).json({ message: 'Invalid status name provided for pending approvals.' });
    }

    try {
        const letters = await Letter.find({ status: statusName });
        res.json(letters);
    } catch (error) {
        console.error("Error fetching pending approvals:", error);
        res.status(500).json({ message: 'Server error fetching approvals', error: error.message });
    }
};


// @desc    Update letter status (Approve/Reject)
// @route   PUT /api/letters/:id/status
// @access  Private (Staff, Lecturer, HOD, Dean, VC)
const updateLetterStatus = async (req, res) => {
    const { id } = req.params;
    const { status, comment, approverId } = req.body;

    try {
        const letter = await Letter.findById(id);

        if (!letter) {
            return res.status(404).json({ message: 'Letter not found' });
        }

        const approverUser = await User.findById(approverId);
        if (!approverUser) {
            return res.status(404).json({ message: 'Approver user not found.' });
        }

        const currentStage = approvalStages[letter.currentStageIndex];
        if (req.user.role !== currentStage.approverRole) {
            return res.status(403).json({ message: 'Not authorized to update the status of this letter at this stage.' });
        }

        const currentApproval = letter.approvals.find(a => a.status === 'pending' && a.approverRole === currentStage.approverRole);

        if (status === 'approved') {
            if (currentApproval) {
                currentApproval.status = 'approved';
                currentApproval.approvedAt = new Date();
                currentApproval.approverId = approverId;
                currentApproval.approverName = approverUser.name;
                currentApproval.comment = comment || '';
            }

            const nextStageIndex = letter.currentStageIndex + 1;
            const nextStage = approvalStages[nextStageIndex];
            letter.currentStageIndex = nextStageIndex;
            letter.status = nextStage.name;

            if (nextStage.approverRole) {
                letter.approvals.push({
                    approverRole: nextStage.approverRole,
                    status: 'pending'
                });
            }
        } else if (status === 'rejected') {
            if (currentApproval) {
                currentApproval.status = 'rejected';
                currentApproval.approvedAt = new Date();
                currentApproval.approverId = approverId;
                currentApproval.approverName = approverUser.name;
                currentApproval.comment = comment || 'Request rejected';
            }
            letter.status = 'Rejected';
        } else {
            return res.status(400).json({ message: 'Invalid status' });
        }

        letter.lastUpdated = new Date();
        const updatedLetter = await letter.save();
        res.json(updatedLetter);

    } catch (error) {
        console.error("Error updating letter status:", error);
        res.status(500).json({ message: 'Server error updating letter status', error: error.message });
    }
};

export { createLetter, getLetterById, getLettersByUserId, getPendingApprovals, updateLetterStatus, getAllLetters };

