import EmailTemplate from '../models/EmailTemplate.js';
import EmailLog from '../models/EmailLog.js';
import User from '../models/User.js';
import { sendEmail } from '../utils/mailService.js';

// @desc    Get all email templates
// @route   GET /api/email-management/templates
// @access  Private/Admin
const getEmailTemplates = async (req, res) => {
    try {
        const { category, isActive } = req.query;

        const query = {};
        if (category) query.category = category;
        if (isActive !== undefined) query.isActive = isActive === 'true';

        const templates = await EmailTemplate.find(query)
            .populate('createdBy', 'name email')
            .populate('updatedBy', 'name email')
            .sort({ category: 1, name: 1 });

        res.json(templates);
    } catch (error) {
        console.error('Error fetching email templates:', error);
        res.status(500).json({ message: 'Error fetching email templates', error: error.message });
    }
};

// @desc    Create email template
// @route   POST /api/email-management/templates
// @access  Private/Admin
const createEmailTemplate = async (req, res) => {
    try {
        const { name, subject, htmlContent, textContent, variables, category, isActive, isDefault } = req.body;

        const template = await EmailTemplate.create({
            name,
            subject,
            htmlContent,
            textContent,
            variables,
            category,
            isActive,
            isDefault,
            createdBy: req.user._id,
            updatedBy: req.user._id,
        });

        res.status(201).json(template);
    } catch (error) {
        console.error('Error creating email template:', error);
        res.status(500).json({ message: 'Error creating email template', error: error.message });
    }
};

// @desc    Update email template
// @route   PUT /api/email-management/templates/:id
// @access  Private/Admin
const updateEmailTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, subject, htmlContent, textContent, variables, category, isActive, isDefault } = req.body;

        const template = await EmailTemplate.findByIdAndUpdate(
            id,
            {
                name,
                subject,
                htmlContent,
                textContent,
                variables,
                category,
                isActive,
                isDefault,
                updatedBy: req.user._id,
            },
            { new: true }
        );

        if (!template) {
            return res.status(404).json({ message: 'Email template not found' });
        }

        res.json(template);
    } catch (error) {
        console.error('Error updating email template:', error);
        res.status(500).json({ message: 'Error updating email template', error: error.message });
    }
};

// @desc    Delete email template
// @route   DELETE /api/email-management/templates/:id
// @access  Private/Admin
const deleteEmailTemplate = async (req, res) => {
    try {
        const { id } = req.params;

        const template = await EmailTemplate.findByIdAndDelete(id);

        if (!template) {
            return res.status(404).json({ message: 'Email template not found' });
        }

        res.json({ message: 'Email template deleted successfully' });
    } catch (error) {
        console.error('Error deleting email template:', error);
        res.status(500).json({ message: 'Error deleting email template', error: error.message });
    }
};

// @desc    Send bulk email
// @route   POST /api/email-management/bulk-send
// @access  Private/Admin
const sendBulkEmail = async (req, res) => {
    try {
        const { recipients, templateId, subject, customMessage, filters } = req.body;

        let recipientList = [];

        if (recipients && recipients.length > 0) {
            recipientList = recipients;
        } else if (filters) {
            // Get users based on filters
            const query = {};
            if (filters.role) query.role = filters.role;
            if (filters.department) query.department = filters.department;
            if (filters.isActive !== undefined) query.isActive = filters.isActive;

            const users = await User.find(query, 'email');
            recipientList = users.map(u => u.email);
        }

        if (recipientList.length === 0) {
            return res.status(400).json({ message: 'No recipients found' });
        }

        let emailContent = customMessage;
        let emailSubject = subject;

        if (templateId) {
            const template = await EmailTemplate.findById(templateId);
            if (template) {
                emailContent = template.htmlContent;
                emailSubject = template.subject;
            }
        }

        // Send emails
        const emailPromises = recipientList.map(async (email) => {
            try {
                await sendEmail({
                    to: email,
                    subject: emailSubject,
                    html: emailContent,
                });

                // Log email
                await EmailLog.create({
                    to: [email],
                    subject: emailSubject,
                    htmlContent: emailContent,
                    templateUsed: templateId,
                    status: 'SENT',
                    sentBy: req.user._id,
                    sentAt: new Date(),
                });

                return { email, status: 'sent' };
            } catch (error) {
                // Log failed email
                await EmailLog.create({
                    to: [email],
                    subject: emailSubject,
                    htmlContent: emailContent,
                    templateUsed: templateId,
                    status: 'FAILED',
                    sentBy: req.user._id,
                    error: error.message,
                });

                return { email, status: 'failed', error: error.message };
            }
        });

        const results = await Promise.all(emailPromises);

        const sent = results.filter(r => r.status === 'sent').length;
        const failed = results.filter(r => r.status === 'failed').length;

        res.json({
            message: `Bulk email sent to ${sent} recipients, ${failed} failed`,
            results,
        });
    } catch (error) {
        console.error('Error sending bulk email:', error);
        res.status(500).json({ message: 'Error sending bulk email', error: error.message });
    }
};

// @desc    Get email logs
// @route   GET /api/email-management/logs
// @access  Private/Admin
const getEmailLogs = async (req, res) => {
    try {
        const { status, startDate, endDate, page = 1, limit = 50 } = req.query;

        const query = {};

        if (status) query.status = status;

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            EmailLog.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('sentBy', 'name email')
                .populate('templateUsed', 'name'),
            EmailLog.countDocuments(query),
        ]);

        res.json({
            logs,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit),
            },
        });
    } catch (error) {
        console.error('Error fetching email logs:', error);
        res.status(500).json({ message: 'Error fetching email logs', error: error.message });
    }
};

export {
    getEmailTemplates,
    createEmailTemplate,
    updateEmailTemplate,
    deleteEmailTemplate,
    sendBulkEmail,
    getEmailLogs,
};
