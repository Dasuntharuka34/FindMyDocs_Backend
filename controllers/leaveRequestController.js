import { uploadToBlob } from '../config/vercelBlob.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Workflow from '../models/Workflow.js';
import { createAndSendNotification } from './notificationController.js';
import { evaluateAutoApproval } from '../utils/autoApprovalEngine.js';

const submitterRoleToInitialStageIndex = {
  "Student": 1,
  "Lecturer": 2,
  "HOD": 3,
  "Dean": 4,
};

// @desc    Create a new leave request
// @route   POST /api/leaverequests
// @access  Private
const createLeaveRequest = async (req, res) => {
  try {
    const {
      requesterId,
      requesterName,
      requesterRole,
      reason,
      startDate,
      endDate,
      reasonDetails,
      contactDuringLeave,
      remarks,
    } = req.body;

    if (!requesterId || !requesterName || !requesterRole || !reason || !startDate || !endDate) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Handle file attachment with validation and upload to Vercel Blob
    let attachmentUrl = null;
    const uploadedFile = req.file || (req.files && (req.files['leaveForm']?.[0] || req.files['supportingDocument']?.[0]));

    if (uploadedFile) {
      try {
        console.log('Processing uploaded file:', uploadedFile.originalname);
        // Validate file type (similar to excuseRequestController)
        const allowedTypes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        if (!allowedTypes.includes(uploadedFile.mimetype)) {
          console.error('Invalid file type:', uploadedFile.mimetype);
          return res.status(400).json({
            message: 'Invalid file type',
            error: 'Only JPEG, PNG, PDF, DOC, and DOCX files are allowed'
          });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `leave-requests/${timestamp}-${uploadedFile.originalname.replace(/\s+/g, '_')}`;

        // Upload to Vercel Blob
        attachmentUrl = await uploadToBlob(uploadedFile.buffer, filename, {
          contentType: uploadedFile.mimetype
        });


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
    const workflow = await Workflow.findOne({ requestType: 'Leave', isActive: true });
    const stages = workflow ? workflow.steps : [
      { name: "Submitted", approverRole: null },
      { name: "Pending Lecturer Approval", approverRole: "Lecturer" },
      { name: "Pending HOD Approval", approverRole: "HOD" },
      { name: "Pending Dean Approval", approverRole: "Dean" },
      { name: "Approved", approverRole: null }
    ];

    // Determine initial stage based on the submitter's role (case-insensitive)
    const normalizedRole = requesterRole.charAt(0).toUpperCase() + requesterRole.slice(1).toLowerCase();
    const initialStageIndex = submitterRoleToInitialStageIndex[normalizedRole] ?? (stages.length > 2 ? 1 : 0);

    const stage = stages[initialStageIndex];
    if (!stage) {
      return res.status(500).json({ message: 'Internal server error: Invalid approval stage index' });
    }
    const initialStatus = stage.name;
    const firstApproverRole = stage.approverRole;

    if (!firstApproverRole && initialStageIndex < stages.length - 1) {
      console.error('Invalid stage configuration: firstApproverRole is null for active stage', initialStatus);
      return res.status(500).json({ message: 'Internal server error: Invalid approval stage configuration' });
    }

    const newRequest = new LeaveRequest({
      studentId: requesterId,
      studentName: requesterName,
      reason,
      reasonDetails: reasonDetails || '',
      contactDuringLeave: contactDuringLeave || '',
      remarks: remarks || '',
      startDate,
      endDate,
      attachments: attachmentUrl, // Store the URL from Vercel Blob
      status: initialStatus,
      currentStageIndex: initialStageIndex,
      submittedDate: new Date(),
    });

    // Add the first stage to the approvals array
    newRequest.approvals.push({
      approverRole: firstApproverRole,
      status: 'pending'
    });
    // Check for Auto Approval
    const shouldAutoApprove = await evaluateAutoApproval({ ...req.body, startDate, endDate }, 'Leave');

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
        message: 'Your leave request has been Auto-Approved based on system rules.',
        type: 'success',
      }).catch(e => console.error(e));

    } else {
      // Add the first stage to the approvals array
      newRequest.approvals.push({
        approverRole: firstApproverRole,
        status: 'pending'
      });

      // Notify the requester
      await createAndSendNotification({
        userId: requesterId,
        message: `Your leave request has been submitted. Status: ${initialStatus}.`,
        type: 'info',
      });

      // Notify the first approver role
      if (firstApproverRole) {
        const approvers = await User.find({ role: firstApproverRole });
        if (approvers.length > 0) {
          for (const approver of approvers) {
            await createAndSendNotification({
              userId: approver._id,
              message: `New leave request from ${requesterName} is awaiting your approval.`,
              type: 'info',
            });
          }
        } else {
          console.warn(`No users with role '${firstApproverRole}' found to send notification.`);
        }
      }
    }

    const createdRequest = await newRequest.save();

    // If not auto-approved, the requester notification is handled in the else block above.
    // If auto-approved, a specific success notification is sent.
    // So, the generic requester notification here is removed.

    res.status(201).json({ message: 'Leave request submitted successfully!', request: createdRequest });

  } catch (error) {
    console.error("Error creating leave request:", error);
    res.status(500).json({ message: 'Error submitting leave request', error: error.message });
  }
};

// --- GET PENDING APPROVALS (Updated to be role-based) ---
// @desc    Get all pending leave requests for a specific role
// @route   GET /api/leaverequests/pendingApprovals
// @access  Private
const getPendingLeaveRequests = async (req, res) => {
  try {
    const userRole = req.user.role;

    // Fetch dynamic workflow
    const workflow = await Workflow.findOne({ requestType: 'Leave', isActive: true });
    if (!workflow) {
      return res.status(404).json({ message: 'Active Leave workflow not found' });
    }

    // Find all steps where this user's role is the approver
    const userSteps = workflow.steps.filter(step => step.approverRole === userRole);

    if (userSteps.length === 0 && userRole !== 'Admin') {
      return res.status(200).json([]); // No steps for this role
    }

    let query = {};
    if (userRole !== 'Admin') {
      const pendingStatuses = userSteps.map(step => step.name);
      query = { status: { $in: pendingStatuses } };
    }
    // Admin sees all pending (not Approved/Rejected)
    else {
      query = { status: { $nin: ['Approved', 'Rejected'] } };
    }

    const requests = await LeaveRequest.find(query)
      .sort({ submittedDate: -1 });
    res.status(200).json(requests);
  } catch (error) {
    console.error("Error fetching pending leave requests:", error);
    res.status(500).json({ message: 'Error fetching pending leave requests', error: error.message });
  }
};
// --- END GET PENDING APPROVALS ---

// @desc    Get all leave requests (for all approvers)
// @route   GET /api/leaverequests
// @access  Private
const getLeaveRequests = async (req, res) => {
  try {
    const requests = await LeaveRequest.find({});
    res.status(200).json(requests);
  } catch (error) {
    console.error("Error fetching all leave requests:", error);
    res.status(500).json({ message: 'Error fetching leave requests', error: error.message });
  }
};

// @desc    Get a single leave request by ID
// @route   GET /api/leaverequests/:id
// @access  Private
const getLeaveRequestById = async (req, res) => {
  const { id } = req.params;
  try {
    const request = await LeaveRequest.findById(id);
    if (request) {
      res.json(request);
    } else {
      res.status(404).json({ message: 'Leave request not found' });
    }
  } catch (error) {
    console.error("Error fetching leave request by ID:", error);
    res.status(500).json({ message: 'Server error fetching leave request by ID', error: error.message });
  }
};

// @desc    Get leave requests for a logged-in user
// @route   GET /api/leaverequests/byUser/:userId
// @access  Private
const getLeaveRequestsByUserId = async (req, res) => {
  const userId = req.params.userId;
  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  // Authorization check: only admin or the user themselves can view the requests
  if (req.user.role.toLowerCase() !== 'admin' && req.user._id.toString() !== userId) {
    return res.status(403).json({ message: 'Forbidden: You are not authorized to view these requests.' });
  }

  try {
    const requests = await LeaveRequest.find({ studentId: userId });
    res.json(requests);
  } catch (error) {
    console.error("Error fetching user's leave requests:", error);
    res.status(500).json({ message: "Server error when fetching user's leave requests", error: error.message });
  }
};

// @desc    Handle approval for a leave request
// @route   PUT /api/leaverequests/:id/approve
// @access  Private (e.g., approver roles)
const approveLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { approverId, comment } = req.body;

    const request = await LeaveRequest.findById(id);

    if (!request) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    const workflow = await Workflow.findOne({ requestType: 'Leave', isActive: true });
    if (!workflow) return res.status(500).json({ message: 'System workflow not found.' });
    const stages = workflow.steps;

    const currentStage = stages[request.currentStageIndex];
    if (!currentStage || req.user.role !== currentStage.approverRole) {
      return res.status(403).json({ message: 'You are not authorized to approve this request at this stage.' });
    }

    // Get the approver user details from database
    const approverUser = await User.findById(approverId);
    if (!approverUser) {
      return res.status(404).json({ message: 'Approver user not found.' });
    }

    const nextStageIndex = request.currentStageIndex + 1;
    let nextStage;

    if (nextStageIndex >= stages.length - 1 || stages[nextStageIndex].name === 'Approved') {
      nextStage = stages[stages.length - 1];
    } else {
      nextStage = stages[nextStageIndex];
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

    request.currentStageIndex = nextStageIndex >= stages.length ? stages.length - 1 : nextStageIndex;
    request.status = nextStage.name;

    // Add new pending approval for the next stage
    if (nextStage.approverRole) {
      request.approvals.push({
        approverRole: nextStage.approverRole,
        status: 'pending'
      });
    }

    await request.save();

    await createAndSendNotification({
      userId: request.studentId,
      message: `Your leave request for ${request.reason} has been approved by ${approverUser.name}. Current status: ${nextStage.name}.`,
      type: 'info',
    });

    if (nextStage.approverRole) {
      const nextApprovers = await User.find({ role: nextStage.approverRole });
      if (nextApprovers.length > 0) {
        for (const approver of nextApprovers) {
          await createAndSendNotification({
            userId: approver._id,
            message: `New leave request from ${request.studentName} is awaiting your approval.`,
            type: 'info',
          });
        }
      } else {
        console.warn(`No users with role '${nextStage.approverRole}' found to send notification.`);
      }
    } else {
      await createAndSendNotification({
        userId: request.studentId,
        message: `Your leave request for ${request.reason} has been fully APPROVED.`,
        type: 'success',
      });
    }

    res.status(200).json({ message: 'Leave request approved successfully!', request });

  } catch (error) {
    console.error("Error approving leave request:", error);
    res.status(500).json({ message: 'Error approving leave request', error: error.message });
  }
};

// @desc    Handle rejection for a leave request
// @route   PUT /api/leaverequests/:id/reject
// @access  Private (e.g., approver roles)
const rejectLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { approverId, comment } = req.body;

    const request = await LeaveRequest.findById(id);

    if (!request) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    const workflow = await Workflow.findOne({ requestType: 'Leave', isActive: true });
    const stages = workflow ? workflow.steps : [];

    const currentStage = stages[request.currentStageIndex];
    if (!currentStage || req.user.role !== currentStage.approverRole) {
      return res.status(403).json({ message: 'You are not authorized to reject this request at this stage.' });
    }

    // Get the approver user details from database
    const approverUser = await User.findById(approverId);
    if (!approverUser) {
      return res.status(404).json({ message: 'Approver user not found.' });
    }

    request.status = 'Rejected';
    request.approvals.push({
      approverRole: nextExpectedApprover,
      approverId: approverId,
      approverName: approverUser.name, // Add approver's name
      status: 'rejected',
      approvedAt: new Date(),
      comment: comment || 'Request rejected'
    });

    await request.save();

    await createAndSendNotification({
      userId: request.studentId,
      message: `Your leave request for ${request.reason} has been REJECTED by ${approverUser.name}.${comment ? ` Reason: ${comment}` : ''}`,
      type: 'error',
    });

    res.status(200).json({ message: 'Leave request rejected.', request });

  } catch (error) {
    console.error("Error rejecting leave request:", error);
    res.status(500).json({ message: 'Error rejecting leave request', error: error.message });
  }
};

// @desc    Delete a leave request
// @route   DELETE /api/leaverequests/:id
// @access  Private (e.g., student who created it or admin)
const deleteLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await LeaveRequest.findById(id);

    if (request) {
      // Authorization check: only admin or the user who created the request can delete it
      if (req.user.role.toLowerCase() !== 'admin' && req.user._id.toString() !== request.studentId.toString()) {
        return res.status(403).json({ message: 'Forbidden: You are not authorized to delete this request.' });
      }
      await request.deleteOne();
      res.json({ message: 'Leave request removed' });
    } else {
      res.status(404).json({ message: 'Leave request not found' });
    }
  } catch (error) {
    console.error("Error deleting leave request:", error);
    res.status(500).json({ message: 'Server error when deleting a leave request', error: error.message });
  }
};

// --- BULK APPROVE LEAVE REQUESTS ---
const bulkApproveLeaveRequests = async (req, res) => {
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
        const request = await LeaveRequest.findById(id);
        if (!request) {
          failureCount++;
          errors.push(`Request ${id} not found`);
          continue;
        }

        // Fetch dynamic workflow
        const workflow = await Workflow.findOne({ requestType: 'Leave', isActive: true });
        const stages = workflow ? workflow.steps : [];

        const currentStage = stages[request.currentStageIndex];
        if (!currentStage || req.user.role !== currentStage.approverRole) {
          failureCount++;
          errors.push(`Not authorized for request ${id}`);
          continue;
        }

        // Approval Logic
        const approverRole = currentStage.approverRole;
        const currentApproval = request.approvals.find(a => a.status === 'pending' && a.approverRole === approverRole);

        if (currentApproval) {
          currentApproval.status = 'approved';
          currentApproval.approvedAt = new Date();
          currentApproval.approverId = approverId;
          currentApproval.approverName = approverUser.name;
          currentApproval.comment = 'Bulk Approved';
        }


        // Check for Auto Approval
        const shouldAutoApprove = await evaluateAutoApproval(finalData, 'Leave');

        if (shouldAutoApprove) {
          request.status = 'Approved';
          request.currentStageIndex = stages.length - 1; // Last stage (Approved)
          request.approvals.push({
            approverRole: 'System', // Indicate system auto-approval
            approverName: 'Auto Approval System',
            status: 'approved',
            approvedAt: new Date(),
            comment: 'Auto-approved based on active rules.'
          });

          // Notify student immediately
          createAndSendNotification({
            userId: req.user._id,
            message: 'Your leave request has been Auto-Approved based on system rules.',
            type: 'success',
          }).catch(e => console.error(e));

        } else {
          const nextStageIndex = request.currentStageIndex + 1;
          const nextStage = stages[nextStageIndex] || stages[stages.length - 1];
          request.currentStageIndex = nextStageIndex >= stages.length ? stages.length - 1 : nextStageIndex;
          request.status = nextStage.name;

          if (nextStage.approverRole) {
            request.approvals.push({
              approverRole: nextStage.approverRole,
              status: 'pending'
            });

            // Uploading might take time, don't await notification
            User.find({ role: nextStage.approverRole }).then(approvers => {
              approvers.forEach(approver => {
                createAndSendNotification({
                  userId: approver._id,
                  message: `New leave request from ${req.user.name} is awaiting approval.`,
                  type: 'info',
                }).catch(e => console.error(e));
              });
            });
          }
        }

        const createdRequest = await request.save();

        if (nextStage.approverRole) {
          // Notify next approvers
          User.find({ role: nextStage.approverRole }).then(approvers => {
            approvers.forEach(approver => {
              createAndSendNotification({
                userId: approver._id,
                message: `New leave request from ${request.studentName} is awaiting approval.`,
                type: 'info',
              }).catch(e => console.error(e));
            });
          });
        } else {
          createAndSendNotification({
            userId: request.studentId,
            message: `Your leave request for ${request.reason} has been fully APPROVED.`,
            type: 'success',
          }).catch(console.error);
        }

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

// --- BULK REJECT LEAVE REQUESTS ---
const bulkRejectLeaveRequests = async (req, res) => {
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
        const request = await LeaveRequest.findById(id);
        if (!request) {
          failureCount++;
          errors.push(`Request ${id} not found`);
          continue;
        }

        const workflow = await Workflow.findOne({ requestType: 'Leave', isActive: true });
        const stages = workflow ? workflow.steps : [];

        const currentStage = stages[request.currentStageIndex];
        if (!currentStage || req.user.role !== currentStage.approverRole) {
          failureCount++;
          errors.push(`Not authorized for request ${id}`);
          continue;
        }

        // Reject Logic
        const approverRole = currentStage.approverRole;
        request.status = 'Rejected';
        request.approvals.push({
          approverRole: approverRole,
          approverId: approverId,
          approverName: approverUser.name,
          status: 'rejected',
          approvedAt: new Date(),
          comment: comment || 'Bulk Rejected'
        });

        await request.save();

        createAndSendNotification({
          userId: request.studentId,
          message: `Your leave request has been REJECTED by ${approverUser.name}.${comment ? ` Reason: ${comment}` : ''}`,
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
  approveLeaveRequest, createLeaveRequest, deleteLeaveRequest, getLeaveRequestById, getLeaveRequests, getLeaveRequestsByUserId,
  // --- EXPORT THE NEW FUNCTION ---
  getPendingLeaveRequests, rejectLeaveRequest,
  bulkApproveLeaveRequests, bulkRejectLeaveRequests
};

