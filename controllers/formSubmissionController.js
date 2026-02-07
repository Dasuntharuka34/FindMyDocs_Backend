
import FormSubmission from '../models/FormSubmission.js';
import Form from '../models/Form.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { sendNotificationEmail } from '../utils/mailService.js';

// @desc    Create a new form submission
// @route   POST /api/form-submissions
// @access  Private
const createSubmission = async (req, res) => {
  try {
    const { formId, data } = req.body;
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
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
    }

    const createdSubmission = await submission.save();

    // Send an email with all unread notifications for the submitting user
    try {
      const unreadNotifications = await Notification.find({ userId: req.user._id, read: false });
      if (unreadNotifications.length > 0) {
        const user = await User.findById(req.user._id);
        if (user && user.email) {
          const notificationMessages = unreadNotifications.map(n => `<li>${n.message}</li>`).join('');
          const emailContent = `
            <p>You have the following unread notifications:</p>
            <ul>
              ${notificationMessages}
            </ul>
            <p>Please log in to your account to view the details.</p>
          `;
          await sendNotificationEmail(user.email, emailContent);
        }
      }
    } catch (emailError) {
      console.error('Error sending notification emails:', emailError);
      // Note: We don't fail the submission if email fails, but log the error
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

      if (status === 'Approved') {
        const nextStageIndex = submission.currentStageIndex + 1;
        if (nextStageIndex >= stages.length) {
          submission.status = 'Approved';
          submission.currentStageIndex = stages.length;
        } else {
          submission.status = stages[nextStageIndex].name;
          submission.currentStageIndex = nextStageIndex;
        }
      } else if (status === 'Rejected') {
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
    res.json(updatedSubmission);
  } catch (error) {
    res.status(400).json({ message: `Error updating submission status: ${error.message}` });
  }
};

export { createSubmission, getSubmissions, getMySubmissions, updateSubmissionStatus, getPendingSubmissions };
