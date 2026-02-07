
import FormSubmission from '../models/FormSubmission.js';
import Form from '../models/Form.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Workflow from '../models/Workflow.js';
import { sendNotificationEmail } from '../utils/mailService.js';
import { put } from '@vercel/blob';
import { createAndSendNotification } from './notificationController.js';

const createSubmission = async (req, res) => {
  try {
    let { formId, data } = req.body;
    console.log(`[SUBMISSION DEBUG] createSubmission. FormId: ${formId}, Files count: ${req.files?.length || 0}`);

    // If sent via FormData, data might be a JSON string
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
        console.log(`[SUBMISSION DEBUG] Parsed data:`, data);
      } catch (e) {
        console.error('Error parsing data JSON:', e);
      }
    }

    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    // Handle file uploads
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const timestamp = Date.now();
          const filename = `form-submissions/${timestamp}-${file.originalname}`;
          const blob = await put(filename, file.buffer, {
            access: 'public',
            contentType: file.mimetype
          });

          // Update the specific field in dynamic data with the URL
          data[file.fieldname] = blob.url;
        } catch (uploadError) {
          console.error('File upload error for field:', file.fieldname, uploadError);
        }
      }
    }

    const submission = new FormSubmission({
      form: formId,
      submittedBy: req.user._id,
      data,
    });

    // Check for dynamic workflow
    const workflow = await Workflow.findOne({ requestType: form.name, isActive: true });
    if (workflow && workflow.steps && workflow.steps.length > 0) {
      submission.status = workflow.steps[0].name;
      submission.currentStageIndex = 0;
      submission.approvals.push({
        approverRole: workflow.steps[0].approverRole,
        status: 'pending'
      });
    }

    const createdSubmission = await submission.save();

    // 1. Notify the student (requester)
    createAndSendNotification({
      userId: req.user._id,
      message: `Your form submission for "${form.name}" has been received. Current status: ${submission.status || 'Submitted'}.`,
      type: 'info',
    }).catch(e => console.error('Failed to notify requester:', e));

    // 2. Notify first approver(s)
    if (workflow && workflow.steps && workflow.steps.length > 0) {
      const firstApproverRole = workflow.steps[0].approverRole;
      if (firstApproverRole) {
        User.find({ role: firstApproverRole }).then(approvers => {
          approvers.forEach(approver => {
            createAndSendNotification({
              userId: approver._id,
              message: `New form submission for "${form.name}" from ${req.user.name} is awaiting your approval.`,
              type: 'info',
            })
              .then(() => console.log(`[DEBUG] Approver notification sent to ${approver._id}`))
              .catch(e => console.error('[DEBUG] Failed to notify approver:', e));
          });
        });
      }
    }

    res.status(201).json(createdSubmission);
  } catch (error) {
    res.status(400).json({ message: `Error creating submission: ${error.message}` });
  }
};

// @desc    Get all form submissions (for admins)
// @route   GET /api/form-submissions
// @access  Private/Admin
const getSubmissions = async (req, res) => {
  try {
    const submissions = await FormSubmission.find({}).populate('form', 'name').populate('submittedBy', 'name');
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get pending form submissions (for admins/approvers)
// @route   GET /api/form-submissions/pending
// @access  Private
const getPendingSubmissions = async (req, res) => {
  try {
    const userRole = req.user.role;
    const isSystemAdmin = userRole.toLowerCase() === 'admin';

    // Fetch all active workflows to identify potential pending statuses for this role
    const workflows = await Workflow.find({ isActive: true });

    let pendingStatuses = ['Pending']; // Always include default Pending

    workflows.forEach(wf => {
      wf.steps.forEach(step => {
        if (step.approverRole.toLowerCase() === userRole.toLowerCase()) {
          pendingStatuses.push(step.name);
        }
      });
    });

    let query = {};
    if (!isSystemAdmin) {
      query = { status: { $in: pendingStatuses } };
    } else {
      // Admin sees everything not final
      query = { status: { $nin: ['Approved', 'Rejected'] } };
    }

    const submissions = await FormSubmission.find(query)
      .populate('form', 'name')
      .populate('submittedBy', 'name')
      .sort({ submittedAt: -1 });

    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get submissions for the logged-in user
// @route   GET /api/form-submissions/my-submissions
// @access  Private
const getMySubmissions = async (req, res) => {
  try {
    const submissions = await FormSubmission.find({ submittedBy: req.user._id })
      .populate('form', 'name')
      .sort({ submittedAt: -1 });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update submission status (approve/reject)
// @route   PUT /api/form-submissions/:id/status
// @access  Private
// @desc    Bulk approve form submissions
// @route   POST /api/form-submissions/bulk-approve
// @access  Private
const bulkApproveSubmissions = async (req, res) => {
  try {
    const { requestIds, approverId } = req.body;
    const submissions = await FormSubmission.find({ _id: { $in: requestIds } }).populate('form');

    let approvedCount = 0;

    for (const submission of submissions) {
      const workflow = await Workflow.findOne({ requestType: submission.form.name, isActive: true });
      if (workflow) {
        const stages = workflow.steps;
        const nextStageIndex = submission.currentStageIndex + 1;
        if (nextStageIndex >= stages.length) {
          submission.status = 'Approved';
          submission.currentStageIndex = stages.length;
        } else {
          submission.status = stages[nextStageIndex].name;
          submission.currentStageIndex = nextStageIndex;
        }
      } else {
        submission.status = 'Approved';
      }
      submission.approver = approverId;
      submission.approvedAt = Date.now();

      const currentApprover = await User.findById(approverId);
      const currentApproval = submission.approvals.find(a => a.status === 'pending' && a.approverRole === (workflow?.steps[submission.currentStageIndex - 1]?.approverRole || workflow?.steps[0]?.approverRole));

      if (currentApproval) {
        currentApproval.status = 'approved';
        currentApproval.approvedAt = new Date();
        currentApproval.approverId = approverId;
        currentApproval.approverName = currentApprover?.name;
        currentApproval.comment = 'Bulk Approved';
      }

      if (submission.status !== 'Approved' && workflow) {
        submission.approvals.push({
          approverRole: workflow.steps[submission.currentStageIndex].approverRole,
          status: 'pending'
        });
      }

      await submission.save();
      approvedCount++;

      // Notify Student
      createAndSendNotification({
        userId: submission.submittedBy,
        message: `Your submission for "${submission.form.name}" has been approved by ${currentApprover?.name || 'an approver'}. Status: ${submission.status}.`,
        type: submission.status === 'Approved' ? 'success' : 'info',
      }).catch(e => console.error('Bulk Notify Student Error:', e));

      // Notify Next Approvers if not fully approved
      if (submission.status !== 'Approved') {
        const nextWorkflow = await Workflow.findOne({ requestType: submission.form.name, isActive: true });
        if (nextWorkflow && nextWorkflow.steps[submission.currentStageIndex]) {
          const nextRole = nextWorkflow.steps[submission.currentStageIndex].approverRole;
          User.find({ role: nextRole }).then(approvers => {
            approvers.forEach(a => {
              createAndSendNotification({
                userId: a._id,
                message: `New form submission for "${submission.form.name}" is now awaiting your approval.`,
                type: 'info',
              }).catch(e => console.error('Bulk Notify Next Approver Error:', e));
            });
          });
        }
      }
    }

    res.json({ message: `Successfully approved ${approvedCount} submissions.` });
  } catch (error) {
    res.status(400).json({ message: `Error in bulk approval: ${error.message}` });
  }
};

// @desc    Bulk reject form submissions
// @route   POST /api/form-submissions/bulk-reject
// @access  Private
const bulkRejectSubmissions = async (req, res) => {
  try {
    const { requestIds, approverId, comment } = req.body;
    const submissions = await FormSubmission.find({ _id: { $in: requestIds } }).populate('form');
    const approver = await User.findById(approverId);

    for (const sub of submissions) {
      const workflow = await Workflow.findOne({ requestType: sub.form.name, isActive: true });
      const currentApproval = sub.approvals.find(a => a.status === 'pending' && (!workflow || a.approverRole === workflow.steps[sub.currentStageIndex]?.approverRole));

      if (currentApproval) {
        currentApproval.status = 'rejected';
        currentApproval.approvedAt = new Date();
        currentApproval.approverId = approverId;
        currentApproval.approverName = approver?.name;
        currentApproval.comment = comment || 'Bulk Rejected';
      }

      sub.status = 'Rejected';
      sub.rejectionReason = comment;
      sub.approver = approverId;
      sub.approvedAt = Date.now();
      await sub.save();
    }

    // Notify each student
    submissions.forEach(sub => {
      createAndSendNotification({
        userId: sub.submittedBy,
        message: `Your submission for "${sub.form.name}" has been REJECTED by ${approver?.name || 'an approver'}.${comment ? ` Reason: ${comment}` : ''}`,
        type: 'error',
      }).catch(e => console.error('Bulk Reject Notify Error:', e));
    });

    res.json({ message: `Successfully rejected ${requestIds.length} submissions.` });
  } catch (error) {
    res.status(400).json({ message: `Error in bulk rejection: ${error.message}` });
  }
};

const updateSubmissionStatus = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const submission = await FormSubmission.findById(req.params.id).populate('form');

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Check for workflow
    const workflow = await Workflow.findOne({ requestType: submission.form.name, isActive: true });

    if (workflow) {
      const stages = workflow.steps;
      const currentStage = stages[submission.currentStageIndex];

      // Authorization check for the current stage
      if (req.user.role !== currentStage.approverRole && req.user.role.toLowerCase() !== 'admin') {
        return res.status(403).json({ message: 'Not authorized for this approval stage' });
      }

      const currentApproval = submission.approvals.find(a => a.status === 'pending' && a.approverRole === currentStage.approverRole);

      if (status === 'Approved') {
        if (currentApproval) {
          currentApproval.status = 'approved';
          currentApproval.approvedAt = new Date();
          currentApproval.approverId = req.user._id;
          currentApproval.approverName = req.user.name;
        }

        const nextStageIndex = submission.currentStageIndex + 1;
        if (nextStageIndex >= stages.length) {
          submission.status = 'Approved';
          submission.currentStageIndex = stages.length;
        } else {
          submission.status = stages[nextStageIndex].name;
          submission.currentStageIndex = nextStageIndex;
          submission.approvals.push({
            approverRole: stages[nextStageIndex].approverRole,
            status: 'pending'
          });
        }
      } else if (status === 'Rejected') {
        if (currentApproval) {
          currentApproval.status = 'rejected';
          currentApproval.approvedAt = new Date();
          currentApproval.approverId = req.user._id;
          currentApproval.approverName = req.user.name;
          currentApproval.comment = rejectionReason || 'Request rejected';
        }
        submission.status = 'Rejected';
        submission.rejectionReason = rejectionReason;
      }
    } else {
      // No workflow, standard approve/reject
      submission.status = status;
      if (status === 'Rejected') {
        submission.rejectionReason = rejectionReason;
      }
    }

    submission.approver = req.user._id;
    submission.approvedAt = Date.now();

    const updatedSubmission = await submission.save();

    // Notify Student
    createAndSendNotification({
      userId: submission.submittedBy,
      message: status === 'Rejected'
        ? `Your submission for "${submission.form.name}" has been REJECTED by ${req.user.name}.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`
        : `Your submission for "${submission.form.name}" has been approved by ${req.user.name}. Status: ${submission.status}.`,
      type: status === 'Rejected' ? 'error' : (submission.status === 'Approved' ? 'success' : 'info'),
    }).catch(e => console.error('Notify Student Error:', e));

    // Notify Next Approvers if approved but not final
    if (status === 'Approved' && submission.status !== 'Approved' && workflow) {
      const nextRole = workflow.steps[submission.currentStageIndex].approverRole;
      if (nextRole) {
        User.find({ role: nextRole }).then(approvers => {
          approvers.forEach(a => {
            createAndSendNotification({
              userId: a._id,
              message: `New form submission for "${submission.form.name}" is now awaiting your approval.`,
              type: 'info',
            }).catch(e => console.error('Notify Next Approver Error:', e));
          });
        });
      }
    }

    res.json(updatedSubmission);
  } catch (error) {
    res.status(400).json({ message: `Error updating submission status: ${error.message}` });
  }
};

// @desc    Get form submission by ID
// @route   GET /api/form-submissions/:id
// @access  Private
const getSubmissionById = async (req, res) => {
  try {
    const submission = await FormSubmission.findById(req.params.id)
      .populate('form')
      .populate('submittedBy', 'name email nic role')
      .populate('approver', 'name role');

    if (submission) {
      // Basic security: only submitter, approver, or admin can view
      const isSubmitter = submission.submittedBy._id.toString() === req.user._id.toString();
      const isAdmin = req.user.role.toLowerCase() === 'admin';

      // For approvers, we check if they have a role that matches any workflow step or if they are generally authorized
      // For now, let's allow all authenticated users to attempt to view, but we could restrict here if needed.

      res.json(submission);
    } else {
      res.status(404).json({ message: 'Submission not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export {
  createSubmission,
  getSubmissions,
  getMySubmissions,
  updateSubmissionStatus,
  getPendingSubmissions,
  getSubmissionById,
  bulkApproveSubmissions,
  bulkRejectSubmissions
};
