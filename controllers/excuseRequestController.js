// controllers/excuseRequestController.js

import ExcuseRequest from '../models/ExcuseRequest.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Workflow from '../models/Workflow.js';
import { put, del } from '@vercel/blob';
import { createAndSendNotification } from './notificationController.js';
import { evaluateAutoApproval } from '../utils/autoApprovalEngine.js';

// Maps student role to initial stage index (fallback logic)
const submitterRoleToInitialStageIndex = {
  "STUDENT": 0,
  "LECTURER": 1,
  "HOD": 2,
  "DEAN": 3,
};

// --- CREATE EXCUSE REQUEST ---
const createExcuseRequest = async (req, res) => {
  try {
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);

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

    // Handle file attachment with validation and upload
    let attachmentUrl = null;
    let fileDetails = null;
    if (req.file) {
      try {
        // Validate file type
        if (!['image/jpeg', 'image/png', 'application/pdf'].includes(req.file.mimetype)) {
          return res.status(400).json({
            message: 'Invalid file type',
            error: 'Only JPEG, PNG and PDF files are allowed'
          });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `excuse-requests/${timestamp}-${req.file.originalname}`;

        // Upload to Vercel Blob
        const blob = await put(filename, req.file.buffer, {
          access: 'public',
          contentType: req.file.mimetype
        });

        attachmentUrl = blob.url;
        console.log('File uploaded successfully to Vercel Blob:', attachmentUrl);

      } catch (error) {
        console.error('File upload error:', error);
        return res.status(500).json({
          message: 'Error uploading file',
          error: error.message
        });
      }
    }

    // Fetch dynamic workflow
    const workflow = await Workflow.findOne({ requestType: 'Excuse', isActive: true });
    const stages = workflow ? workflow.steps : [
      { name: "Pending Lecturer Approval", approverRole: "Lecturer" },
      { name: "Pending HOD Approval", approverRole: "HOD" },
      { name: "Pending Dean Approval", approverRole: "Dean" }
    ];

    // Determine initial stage based on the submitter's role (case-insensitive)
    const normalizedRole = studentRole?.toUpperCase() || "STUDENT";
    const initialStageIndex = submitterRoleToInitialStageIndex[normalizedRole] ?? (stages.length > 2 ? 1 : 0);
    const initialStatus = stages[initialStageIndex].name;
    const firstApproverRole = stages[initialStageIndex].approverRole;

    // Parse absences - handle both string and object
    let parsedAbsences;
    try {
      parsedAbsences = typeof absences === 'string' ? JSON.parse(absences) : absences;
    } catch (parseError) {
      console.error('Error parsing absences:', parseError);
      return res.status(400).json({ message: 'Invalid absences format', error: parseError.message });
    }

    const newRequest = new ExcuseRequest({
      studentId,
      studentName,
      regNo,
      mobile,
      email,
      address,
      levelOfStudy,
      subjectCombo,
      absences: parsedAbsences,
      reason,
      reasonDetails,
      lectureAbsents,
      attachments: attachmentUrl, // Store Vercel Blob URL
      fileDetails: fileDetails || null, // Store compression details if available
      status: initialStatus,
      currentStageIndex: initialStageIndex,
      submittedDate: new Date(),
    });

    // Check for Auto Approval
    const shouldAutoApprove = await evaluateAutoApproval({ ...req.body }, 'Excuse');

    if (shouldAutoApprove) {
      newRequest.status = 'Approved';
      newRequest.currentStageIndex = stages.length - 1;
      newRequest.approvals.push({
        approverRole: 'System',
        approverName: 'Auto Approval System',
        status: 'approved',
        approvedAt: new Date(),
        comment: 'Auto-approved based on active rules.'
      });

      // Notify student immediately
      createAndSendNotification({
        userId: req.user._id,
        message: 'Your excuse request has been Auto-Approved based on system rules.',
        type: 'success',
      }).catch(e => console.error(e));

    } else {
      newRequest.approvals.push({
        approverRole: firstApproverRole,
        status: 'pending'
      });

      // Notify requester
      createAndSendNotification({
        userId: studentId,
        message: `Your excuse request has been submitted. Status: ${initialStatus}.`,
        type: 'info',
      }).catch(e => console.error('Failed to send notification to requester:', e));

      // Notify first approver
      if (firstApproverRole) {
        const approvers = await User.find({ role: firstApproverRole });
        for (const approver of approvers) {
          createAndSendNotification({
            userId: approver._id,
            message: `New excuse request from ${studentName} is awaiting your approval.`,
            type: 'info',
          }).catch(e => console.error('Failed to send notification to approver:', e));
        }
      }
    }

    const createdRequest = await newRequest.save();

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

  // Authorization check: only admin or the user themselves can view the requests
  if (req.user.role.toLowerCase() !== 'admin' && req.user._id.toString() !== userId) {
    return res.status(403).json({ message: 'Forbidden: You are not authorized to view these requests.' });
  }

  try {
    const requests = await ExcuseRequest.find({ studentId: userId })
      .sort({ submittedDate: -1 }); // Sort by most recent first
    res.json(requests);
  } catch (error) {
    console.error("Error fetching user's excuse requests:", error);
    res.status(500).json({ message: "Server error fetching user's excuse requests", error: error.message });
  }
};

// --- GET PENDING APPROVALS (Updated to be role-based with defensive checks) ---
const getPendingExcuseApprovals = async (req, res) => {
  try {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: 'User role not found' });
    }
    const userRole = req.user.role;
    const isSystemAdmin = userRole.toLowerCase() === 'admin';

    const workflow = await Workflow.findOne({ requestType: 'Excuse', isActive: true });
    if (!workflow) {
      return res.status(404).json({ message: 'Active Excuse workflow not found' });
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

    const requests = await ExcuseRequest.find(query)
      .sort({ submittedDate: -1 });
    res.json(requests);
  } catch (error) {
    console.error("Error fetching pending excuse approvals:", error);
    res.status(500).json({
      message: 'Server error fetching pending approvals',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' || !process.env.VERCEL ? error.stack : undefined
    });
  }
};

// --- APPROVE EXCUSE REQUEST (UPDATED WITH USER LOOKUP) ---
const approveExcuseRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { approverId, comment } = req.body;

    const request = await ExcuseRequest.findById(id);
    if (!request) return res.status(404).json({ message: 'Excuse request not found.' });

    // Fetch dynamic workflow
    const workflow = await Workflow.findOne({ requestType: 'Excuse', isActive: true });
    if (!workflow) return res.status(500).json({ message: 'System workflow not found.' });
    const stages = workflow.steps;

    const currentStage = stages[request.currentStageIndex];
    if (!currentStage || req.user.role !== currentStage.approverRole) {
      return res.status(403).json({ message: 'Not authorized to approve at this stage.' });
    }

    // Get the approver user details from database
    const approverUser = await User.findById(approverId);
    if (!approverUser) {
      return res.status(404).json({ message: 'Approver user not found.' });
    }

    // Update the pending approval
    const approverRole = stages[request.currentStageIndex].approverRole;
    const currentApproval = request.approvals.find(a => a.status === 'pending' && a.approverRole === approverRole);
    if (currentApproval) {
      currentApproval.status = 'approved';
      currentApproval.approvedAt = new Date();
      currentApproval.approverId = approverId;
      currentApproval.approverName = approverUser.name;
      currentApproval.comment = comment || '';
    }

    const nextStageIndex = request.currentStageIndex + 1;
    if (nextStageIndex >= stages.length) {
      request.currentStageIndex = stages.length; // Beyond last stage
      request.status = 'Approved';
    } else {
      const nextStage = stages[nextStageIndex];
      request.currentStageIndex = nextStageIndex;
      request.status = nextStage.name;

      // Add new pending approval for the next stage
      if (nextStage.approverRole) {
        request.approvals.push({
          approverRole: nextStage.approverRole,
          status: 'pending'
        });
      }
    }
    request.lastUpdated = new Date();

    await request.save();

    // Notify requester
    await createAndSendNotification({
      userId: request.studentId,
      message: `Your excuse request for ${request.reason} has been approved by ${approverUser.name}. Current status: ${request.status}.`,
      type: 'info',
    });

    // Notify next approver
    if (request.status !== 'Approved') {
      const nextStage = stages[request.currentStageIndex];
      if (nextStage && nextStage.approverRole) {
        const nextApprovers = await User.find({ role: nextStage.approverRole });
        for (const approver of nextApprovers) {
          await createAndSendNotification({
            userId: approver._id,
            message: `New excuse request from ${request.studentName} is awaiting your approval.`,
            type: 'info',
          });
        }
      }
    } else {
      await createAndSendNotification({
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
    const { approverId, comment } = req.body;

    const request = await ExcuseRequest.findById(id);
    if (!request) return res.status(404).json({ message: 'Excuse request not found.' });

    const workflow = await Workflow.findOne({ requestType: 'Excuse', isActive: true });
    const stages = workflow ? workflow.steps : [];

    const currentStage = stages[request.currentStageIndex];
    if (!currentStage || req.user.role !== currentStage.approverRole) {
      return res.status(403).json({ message: 'Not authorized to reject at this stage.' });
    }

    // Get the approver user details from database
    const approverUser = await User.findById(approverId);
    if (!approverUser) {
      return res.status(404).json({ message: 'Approver user not found.' });
    }

    // Update the pending approval
    const approverRole = stages[request.currentStageIndex].approverRole;
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

    await createAndSendNotification({
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

    // Delete associated file if it exists
    if (request.attachments) {
      try {
        await del(request.attachments);
        console.log('File deleted successfully from Vercel Blob');
      } catch (error) {
        console.error('Error deleting file from Vercel Blob:', error);
        // Continue with request deletion even if file deletion fails
      }
    }

    await request.deleteOne();
    res.json({ message: 'Excuse request and associated files removed' });
  } catch (error) {
    console.error("Error deleting excuse request:", error);
    res.status(500).json({ message: 'Server error deleting excuse request', error: error.message });
  }
};

// --- BULK APPROVE EXCUSE REQUESTS ---
const bulkApproveExcuseRequests = async (req, res) => {
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
        const request = await ExcuseRequest.findById(id);
        if (!request) {
          failureCount++;
          errors.push(`Request ${id} not found`);
          continue;
        }

        // Fetch dynamic workflow
        const workflow = await Workflow.findOne({ requestType: 'Excuse', isActive: true });
        const stages = workflow ? workflow.steps : [];

        const currentStage = stages[request.currentStageIndex];
        if (!currentStage || req.user.role !== currentStage.approverRole) {
          failureCount++;
          errors.push(`Not authorized for request ${id}`);
          continue;
        }

        // Approval Logic (same as single approve)
        const approverRole = currentStage.approverRole;
        const currentApproval = request.approvals.find(a => a.status === 'pending' && a.approverRole === approverRole);

        if (currentApproval) {
          currentApproval.status = 'approved';
          currentApproval.approvedAt = new Date();
          currentApproval.approverId = approverId;
          currentApproval.approverName = approverUser.name;
          currentApproval.comment = 'Bulk Approved';
        }

        const nextStageIndex = request.currentStageIndex + 1;

        if (nextStageIndex >= stages.length) {
          request.currentStageIndex = stages.length;
          request.status = 'Approved';
        } else {
          const nextStage = stages[nextStageIndex];
          request.currentStageIndex = nextStageIndex;
          request.status = nextStage.name;

          if (nextStage.approverRole) {
            request.approvals.push({
              approverRole: nextStage.approverRole,
              status: 'pending'
            });
          }
        }

        request.lastUpdated = new Date();
        await request.save();

        // Notification (fire and forget to not block loop too much)
        createAndSendNotification({
          userId: request.studentId,
          message: `Your excuse request has been approved by ${approverUser.name}. Current status: ${request.status}.`,
          type: 'info',
        }).catch(err => console.error('Notification error', err));

        successCount++;
      } catch (err) {
        console.error(`Error processing request ${id}:`, err);
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

// --- BULK REJECT EXCUSE REQUESTS ---
const bulkRejectExcuseRequests = async (req, res) => {
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
        const request = await ExcuseRequest.findById(id);
        if (!request) {
          failureCount++;
          errors.push(`Request ${id} not found`);
          continue;
        }

        const workflow = await Workflow.findOne({ requestType: 'Excuse', isActive: true });
        const stages = workflow ? workflow.steps : [];

        const currentStage = stages[request.currentStageIndex];
        if (!currentStage || req.user.role !== currentStage.approverRole) {
          failureCount++;
          errors.push(`Not authorized for request ${id}`);
          continue;
        }

        // Reject Logic
        const approverRole = currentStage.approverRole;
        const currentApproval = request.approvals.find(a => a.status === 'pending' && a.approverRole === approverRole);

        if (currentApproval) {
          currentApproval.status = 'rejected';
          currentApproval.approvedAt = new Date();
          currentApproval.approverId = approverId;
          currentApproval.approverName = approverUser.name;
          currentApproval.comment = comment || 'Bulk Rejected';
        }

        request.status = 'Rejected';
        request.lastUpdated = new Date();
        await request.save();

        createAndSendNotification({
          userId: request.studentId,
          message: `Your excuse request has been REJECTED by ${approverUser.name}.${comment ? ` Reason: ${comment}` : ''}`,
          type: 'error',
        }).catch(err => console.error('Notification error', err));

        successCount++;
      } catch (err) {
        console.error(`Error rejecting request ${id}:`, err);
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

export {
  approveExcuseRequest, createExcuseRequest, deleteExcuseRequest, getExcuseRequestById,
  getExcuseRequests, getExcuseRequestsByUserId, getPendingExcuseApprovals, rejectExcuseRequest,
  bulkApproveExcuseRequests, bulkRejectExcuseRequests
};
