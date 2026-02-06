import Letter from '../models/Letter.js';
import User from '../models/User.js';
import Workflow from '../models/Workflow.js';
import { uploadToBlob } from '../config/vercelBlob.js';

// Maps submitter roles to the initial stage index (fallback logic)
const submitterRoleToInitialStageIndex = {
    "STUDENT": 0,
    "LECTURER": 1,
    "HOD": 2,
    "DEAN": 3,
    "VC": 4
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

    // Fetch dynamic workflow
    const workflow = await Workflow.findOne({ requestType: 'Letter', isActive: true });
    const stages = workflow ? workflow.steps : [
        { name: "Pending Lecturer Approval", approverRole: "Lecturer" },
        { name: "Pending HOD Approval", approverRole: "HOD" },
        { name: "Pending Dean Approval", approverRole: "Dean" }
    ];

    // Determine initial stage based on the submitter's role (case-insensitive)
    const normalizedRole = submitterRole?.toUpperCase() || "STUDENT";
    const initialStageIndex = submitterRoleToInitialStageIndex[normalizedRole] ?? (stages.length > 2 ? 1 : 0);
    const initialStatus = stages[initialStageIndex].name;
    const firstApproverRole = stages[initialStageIndex].approverRole;

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

            const workflow = await Workflow.findOne({ requestType: 'Letter', isActive: true });
            const stages = workflow ? workflow.steps : [];
            const currentApprovalStage = stages[letter.currentStageIndex];
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


// --- GET PENDING APPROVALS (Updated to be role-based with defensive checks) ---
// @desc    Get pending approvals for letters based on user role
// @route   GET /api/letters/pendingApprovals
// @access  Private (Staff, Lecturer, HOD, Dean, VC, Admin)
const getPendingApprovals = async (req, res) => {
    try {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ message: 'User role not found' });
        }
        const userRole = req.user.role;
        const isSystemAdmin = userRole.toLowerCase() === 'admin';

        const workflow = await Workflow.findOne({ requestType: 'Letter', isActive: true });
        if (!workflow) {
            return res.status(404).json({ message: 'Active Letter workflow not found' });
        }

        // Find all steps where this user's role is the approver
        const steps = workflow.steps || [];
        const userSteps = steps.filter(step =>
            step.approverRole && step.approverRole.toLowerCase() === userRole.toLowerCase()
        );

        if (userSteps.length === 0 && !isSystemAdmin) {
            return res.status(200).json([]); // No steps for this role
        }

        let query = {};
        if (!isSystemAdmin) {
            const pendingStatuses = userSteps.map(step => step.name);
            query = { status: { $in: pendingStatuses } };
        }
        // Admin sees all pending (not Approved/Rejected)
        else {
            query = { status: { $nin: ['Approved', 'Rejected'] } };
        }

        const letters = await Letter.find(query).sort({ submittedDate: -1 });
        res.json(letters);
    } catch (error) {
        console.error("Error fetching pending approvals:", error);
        res.status(500).json({
            message: 'Server error fetching approvals',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' || !process.env.VERCEL ? error.stack : undefined
        });
    }
};
// --- END GET PENDING APPROVALS ---


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

        const workflow = await Workflow.findOne({ requestType: 'Letter', isActive: true });
        if (!workflow) return res.status(500).json({ message: 'System workflow not found.' });
        const stages = workflow.steps;

        const currentStage = stages[letter.currentStageIndex];
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
            if (nextStageIndex >= stages.length) {
                letter.currentStageIndex = stages.length; // Beyond last stage
                letter.status = 'Approved';
            } else {
                const nextStage = stages[nextStageIndex];
                letter.currentStageIndex = nextStageIndex;
                letter.status = nextStage.name;

                if (nextStage.approverRole) {
                    letter.approvals.push({
                        approverRole: nextStage.approverRole,
                        status: 'pending'
                    });
                }
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

// --- BULK APPROVE LETTERS ---
const bulkApproveLetters = async (req, res) => {
    const { requestIds, approverId } = req.body;

    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
        return res.status(400).json({ message: 'No request IDs provided' });
    }

    let successCount = 0;
    let failureCount = 0;
    const errors = [];

    try {
        const approverUser = await User.findById(approverId);
        if (!approverUser) {
            return res.status(404).json({ message: 'Approver user not found.' });
        }

        for (const id of requestIds) {
            try {
                const letter = await Letter.findById(id);
                if (!letter) {
                    failureCount++;
                    errors.push(`Letter ${id} not found`);
                    continue;
                }

                const workflow = await Workflow.findOne({ requestType: 'Letter', isActive: true });
                const stages = workflow ? workflow.steps : [];

                const currentStage = stages[letter.currentStageIndex];
                if (req.user.role !== currentStage.approverRole) {
                    failureCount++;
                    errors.push(`Not authorized for letter ${id}`);
                    continue;
                }

                const currentApproval = letter.approvals.find(a => a.status === 'pending' && a.approverRole === currentStage.approverRole);

                if (currentApproval) {
                    currentApproval.status = 'approved';
                    currentApproval.approvedAt = new Date();
                    currentApproval.approverId = approverId;
                    currentApproval.approverName = approverUser.name;
                    currentApproval.comment = 'Bulk Approved';
                }

                const nextStageIndex = letter.currentStageIndex + 1;
                if (nextStageIndex >= stages.length) {
                    letter.currentStageIndex = stages.length;
                    letter.status = 'Approved';
                } else {
                    const nextStage = stages[nextStageIndex];
                    letter.currentStageIndex = nextStageIndex;
                    letter.status = nextStage.name;

                    if (nextStage.approverRole) {
                        letter.approvals.push({
                            approverRole: nextStage.approverRole,
                            status: 'pending'
                        });
                    }
                }

                letter.lastUpdated = new Date();
                await letter.save();

                successCount++;
            } catch (err) {
                console.error(`Error processing letter ${id}:`, err);
                failureCount++;
                errors.push(`Error processing ${id}: ${err.message}`);
            }
        }

        res.status(200).json({
            message: `Bulk approval complete. Success: ${successCount}, Failed: ${failureCount}`,
            results: { success: successCount, failure: failureCount, errors }
        });

    } catch (error) {
        console.error("Error in bulk approve:", error);
        res.status(500).json({ message: 'Server error during bulk approval', error: error.message });
    }
};

// --- BULK REJECT LETTERS ---
const bulkRejectLetters = async (req, res) => {
    const { requestIds, approverId, comment } = req.body;

    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
        return res.status(400).json({ message: 'No request IDs provided' });
    }

    let successCount = 0;
    let failureCount = 0;
    const errors = [];

    try {
        const approverUser = await User.findById(approverId);
        if (!approverUser) {
            return res.status(404).json({ message: 'Approver user not found.' });
        }

        for (const id of requestIds) {
            try {
                const letter = await Letter.findById(id);
                if (!letter) {
                    failureCount++;
                    errors.push(`Letter ${id} not found`);
                    continue;
                }

                const workflow = await Workflow.findOne({ requestType: 'Letter', isActive: true });
                const stages = workflow ? workflow.steps : [];

                const currentStage = stages[letter.currentStageIndex];
                if (req.user && req.user.role !== currentStage.approverRole) {
                    failureCount++;
                    errors.push(`Not authorized for letter ${id}`);
                    continue;
                }

                const currentApproval = letter.approvals.find(a => a.status === 'pending' && a.approverRole === currentStage.approverRole);

                if (currentApproval) {
                    currentApproval.status = 'rejected';
                    currentApproval.approvedAt = new Date();
                    currentApproval.approverId = approverId;
                    currentApproval.approverName = approverUser.name;
                    currentApproval.comment = comment || 'Bulk Rejected';
                }

                letter.status = 'Rejected';
                letter.lastUpdated = new Date();
                await letter.save();

                successCount++;
            } catch (err) {
                console.error(`Error rejecting letter ${id}:`, err);
                failureCount++;
                errors.push(`Error processing ${id}: ${err.message}`);
            }
        }

        res.status(200).json({
            message: `Bulk rejection complete. Success: ${successCount}, Failed: ${failureCount}`,
            results: { success: successCount, failure: failureCount, errors }
        });

    } catch (error) {
        console.error("Error in bulk reject:", error);
        res.status(500).json({ message: 'Server error during bulk rejection', error: error.message });
    }
};

export { createLetter, getLetterById, getLettersByUserId, getPendingApprovals, updateLetterStatus, getAllLetters, bulkApproveLetters, bulkRejectLetters };
