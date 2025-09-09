// controllers/excuseRequestController.js

import ExcuseRequest from '../models/ExcuseRequest.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js'; // Make sure to import User model

// --- APPROVAL STAGE DEFINITIONS ---
const approvalStages = [
  { name: "Submitted", approverRole: null },
  { name: "Pending Lecturer Approval", approverRole: "Lecturer" },
  { name: "Pending HOD Approval", approverRole: "HOD" },
  { name: "Pending Dean Approval", approverRole: "Dean" },
  { name: "Pending VC Approval", approverRole: "VC" },
  { name: "Approved", approverRole: null }
];

// Maps student role to initial stage index
const submitterRoleToInitialStageIndex = {
  "Student": 1,
  "Lecturer": 2,   // Lecturer submits, skips Staff, starts at "Pending Lecturer Approval"
  "HOD": 3,        // HOD submits, skips Staff, Lecturer, starts at "Pending HOD Approval"
  "Dean": 4,
};

// --- CREATE EXCUSE REQUEST ---
const createExcuseRequest = async (req, res) => {
  try {
    const {
      studentId,
      studentName,
      studentRole,
      regNo,
      mobile,
      email,
      address,
      levelOfStudy,
      subjectCombo,
      absences,
      reason,
      reasonDetails,
      lectureAbsents,
    } = req.body;

    if (!studentId || !studentName || !regNo || !absences || !reason) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const initialStageIndex = submitterRoleToInitialStageIndex[studentRole] || 1;
    const initialStatus = approvalStages[initialStageIndex].name;
    const firstApproverRole = approvalStages[initialStageIndex].approverRole;

    const newRequest = new ExcuseRequest({
      studentId,
      studentName,
      regNo,
      mobile,
      email,
      address,
      levelOfStudy,
      subjectCombo,
      absences: JSON.parse(absences),
      reason,
      reasonDetails,
      lectureAbsents,
      attachments: req.file ? req.file.path : null,
      status: initialStatus,
      currentStageIndex: initialStageIndex,
      submittedDate: new Date(),
    });

    newRequest.approvals.push({
      approverRole: firstApproverRole,
      status: 'pending'
    });

    const createdRequest = await newRequest.save();

    // Notify requester
    await Notification.create({
      userId: studentId,
      message: `Your excuse request has been submitted. Status: ${initialStatus}.`,
      type: 'info',
    });

    // Notify first approver
    if (firstApproverRole) {
      const approvers = await User.find({ role: firstApproverRole });
      for (const approver of approvers) {
        await Notification.create({
          userId: approver._id,
          message: `New excuse request from ${studentName} is awaiting your approval.`,
          type: 'info',
        });
      }
    }

    res.status(201).json({ message: 'Excuse request submitted successfully!', request: createdRequest });
  } catch (error) {
    console.error("Error creating excuse request:", error);
    res.status(500).json({ message: 'Error submitting excuse request', error: error.message });
  }
};

// --- GET ALL EXCUSE REQUESTS ---
const getExcuseRequests = async (req, res) => {
  try {
    const requests = await ExcuseRequest.find({})
      .sort({ submittedDate: -1 }); // Sort by most recent first
    res.status(200).json(requests);
  } catch (error) {
    console.error("Error fetching all excuse requests:", error);
    res.status(500).json({ message: 'Error fetching excuse requests', error: error.message });
  }
};

// --- GET EXCUSE REQUEST BY ID (UPDATED FOR VIEW) ---
const getExcuseRequestById = async (req, res) => {
  const { id } = req.params;
  try {
    const request = await ExcuseRequest.findById(id);
    if (!request) return res.status(404).json({ message: 'Excuse request not found' });
    
    // Populate approver information if available
    const populatedRequest = await ExcuseRequest.findById(id)
      .populate('approvals.approverId', 'name email role');
    
    res.json(populatedRequest || request);
  } catch (error) {
    console.error("Error fetching excuse request by ID:", error);
    res.status(500).json({ message: 'Server error fetching excuse request by ID', error: error.message });
  }
};

// --- GET USER'S EXCUSE REQUESTS ---
const getExcuseRequestsByUserId = async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ message: 'User ID is required' });

  try {
    const requests = await ExcuseRequest.find({ studentId: userId })
      .sort({ submittedDate: -1 }); // Sort by most recent first
    res.json(requests);
  } catch (error) {
    console.error("Error fetching user's excuse requests:", error);
    res.status(500).json({ message: "Server error fetching user's excuse requests", error: error.message });
  }
};

// --- GET PENDING APPROVALS ---
const getPendingExcuseApprovals = async (req, res) => {
  const { statusName } = req.params;

  const validStatuses = approvalStages.map(stage => stage.name);
  if (!validStatuses.includes(statusName)) {
    return res.status(400).json({ message: 'Invalid status name for pending approvals' });
  }

  try {
    const requests = await ExcuseRequest.find({ status: statusName })
      .sort({ submittedDate: -1 }); // Sort by most recent first
    res.json(requests);
  } catch (error) {
    console.error("Error fetching pending excuse approvals:", error);
    res.status(500).json({ message: 'Server error fetching pending approvals', error: error.message });
  }
};

// --- APPROVE EXCUSE REQUEST (UPDATED WITH USER LOOKUP) ---
const approveExcuseRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { approverRole, approverId, comment } = req.body;

    const request = await ExcuseRequest.findById(id);
    if (!request) return res.status(404).json({ message: 'Excuse request not found.' });

    const nextExpectedApprover = approvalStages[request.currentStageIndex].approverRole;
    if (approverRole !== nextExpectedApprover) {
      return res.status(403).json({ message: 'Not authorized to approve at this stage.' });
    }

    // Get the approver user details from database
    const approverUser = await User.findById(approverId);
    if (!approverUser) {
      return res.status(404).json({ message: 'Approver user not found.' });
    }

    const nextStageIndex = request.currentStageIndex + 1;
    const nextStage = approvalStages[nextStageIndex];

    // Update the pending approval
    const currentApproval = request.approvals.find(a => a.status === 'pending' && a.approverRole === approverRole);
    if (currentApproval) {
      currentApproval.status = 'approved';
      currentApproval.approvedAt = new Date();
      currentApproval.approverId = approverId;
      currentApproval.approverName = approverUser.name; // Use the user's name from database
      currentApproval.comment = comment || '';
    }

    request.currentStageIndex = nextStageIndex;
    request.status = nextStage.name;
    request.lastUpdated = new Date();

    await request.save();

    // Notify requester
    await Notification.create({
      userId: request.studentId,
      message: `Your excuse request for ${request.reason} has been approved by ${approverUser.name}. Current status: ${nextStage.name}.`,
      type: 'info',
    });

    // Notify next approver
    if (nextStage.approverRole) {
      const nextApprovers = await User.find({ role: nextStage.approverRole });
      for (const approver of nextApprovers) {
        await Notification.create({
          userId: approver._id,
          message: `New excuse request from ${request.studentName} is awaiting your approval.`,
          type: 'info',
        });
      }
    } else {
      await Notification.create({
        userId: request.studentId,
        message: `Your excuse request for ${request.reason} has been fully APPROVED.`,
        type: 'success',
      });
    }

    res.status(200).json({ message: 'Excuse request approved successfully!', request });
  } catch (error) {
    console.error("Error approving excuse request:", error);
    res.status(500).json({ message: 'Error approving excuse request', error: error.message });
  }
};

// --- REJECT EXCUSE REQUEST (UPDATED WITH USER LOOKUP) ---
const rejectExcuseRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { approverRole, approverId, comment } = req.body;

    const request = await ExcuseRequest.findById(id);
    if (!request) return res.status(404).json({ message: 'Excuse request not found.' });

    const nextExpectedApprover = approvalStages[request.currentStageIndex].approverRole;
    if (approverRole !== nextExpectedApprover) {
      return res.status(403).json({ message: 'Not authorized to reject at this stage.' });
    }

    // Get the approver user details from database
    const approverUser = await User.findById(approverId);
    if (!approverUser) {
      return res.status(404).json({ message: 'Approver user not found.' });
    }

    // Update the pending approval
    const currentApproval = request.approvals.find(a => a.status === 'pending' && a.approverRole === approverRole);
    if (currentApproval) {
      currentApproval.status = 'rejected';
      currentApproval.approvedAt = new Date();
      currentApproval.approverId = approverId;
      currentApproval.approverName = approverUser.name; // Use the user's name from database
      currentApproval.comment = comment || 'Request rejected';
    }

    request.status = 'Rejected';
    request.lastUpdated = new Date();

    await request.save();

    await Notification.create({
      userId: request.studentId,
      message: `Your excuse request for ${request.reason} has been REJECTED by ${approverUser.name}.${comment ? ` Reason: ${comment}` : ''}`,
      type: 'error',
    });

    res.status(200).json({ message: 'Excuse request rejected.', request });
  } catch (error) {
    console.error("Error rejecting excuse request:", error);
    res.status(500).json({ message: 'Error rejecting excuse request', error: error.message });
  }
};

// --- DELETE EXCUSE REQUEST ---
const deleteExcuseRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await ExcuseRequest.findById(id);

    if (!request) return res.status(404).json({ message: 'Excuse request not found' });

    await request.deleteOne();
    res.json({ message: 'Excuse request removed' });
  } catch (error) {
    console.error("Error deleting excuse request:", error);
    res.status(500).json({ message: 'Server error deleting excuse request', error: error.message });
  }
};

export {
  createExcuseRequest,
  getExcuseRequests,
  getExcuseRequestById,
  getExcuseRequestsByUserId,
  approveExcuseRequest,
  rejectExcuseRequest,
  deleteExcuseRequest,
  getPendingExcuseApprovals
};