
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
// @access  Private/Admin
const getPendingSubmissions = async (req, res) => {
  try {
    const submissions = await FormSubmission.find({ status: 'Pending' }).populate('form', 'name').populate('submittedBy', 'name');
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
      const submissions = await FormSubmission.find({ submittedBy: req.user._id }).populate('form', 'name');
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

// @desc    Update submission status (approve/reject)
// @route   PUT /api/form-submissions/:id/status
// @access  Private/Admin
const updateSubmissionStatus = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const submission = await FormSubmission.findById(req.params.id);

    if (submission) {
      submission.status = status;
      submission.approver = req.user._id;
      submission.approvedAt = Date.now();
      if (status === 'Rejected') {
        submission.rejectionReason = rejectionReason;
      }

      const updatedSubmission = await submission.save();
      res.json(updatedSubmission);
    } else {
      res.status(404).json({ message: 'Submission not found' });
    }
  } catch (error) {
    res.status(400).json({ message: `Error updating submission status: ${error.message}` });
  }
};

export { createSubmission, getSubmissions, getMySubmissions, updateSubmissionStatus, getPendingSubmissions };
