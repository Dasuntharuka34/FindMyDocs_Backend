import Letter from '../models/Letter.js';

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
    const attachmentsPath = req.file ? req.file.path : null; 

    const initialStageIndex = submitterRoleToInitialStageIndex[submitterRole] !== undefined
                               ? submitterRoleToInitialStageIndex[submitterRole]
                               : 0;
    const initialStatus = approvalStages[initialStageIndex].name;

    try {
        const letter = await Letter.create({
            type,
            reason,
            date,
            studentId,
            student,
            status: initialStatus,
            currentStageIndex: initialStageIndex,
            submittedDate: new Date(),
            attachments: attachmentsPath 
        });
        res.status(201).json(letter);
    } catch (error) {
        console.error("Error creating letter:", error);
        res.status(500).json({ message: 'Server error creating letter', error: error.message });
    }
};

// @desc    Get letters submitted by a specific user
// @route   GET /api/letters/byUser/:userId
// @access  Private (Student only)
const getLettersByUserId = async (req, res) => {
    const { userId } = req.params;
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
        const letter = await Letter.findById(id);
        if (letter) {
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
    const { status, currentStageIndex, rejectionReason, approver, approverRole } = req.body;

    try {
        const letter = await Letter.findById(id);

        if (!letter) {
            return res.status(404).json({ message: 'Letter not found' });
        }

        letter.status = status;
        letter.currentStageIndex = currentStageIndex;
        letter.lastUpdated = new Date();

        if (rejectionReason) {
            letter.rejectionReason = rejectionReason;
        } else {
            letter.rejectionReason = undefined;
        }

        letter.approver = approver;
        letter.approverRole = approverRole;

        const updatedLetter = await letter.save();
        res.json(updatedLetter);

    } catch (error) {
        console.error("Error updating letter status:", error);
        res.status(500).json({ message: 'Server error updating letter status', error: error.message });
    }
};

export { createLetter, getLettersByUserId, getLetterById, updateLetterStatus, getPendingApprovals };

