import RequestTemplate from '../models/RequestTemplate.js';

// @desc    Create a new request template
// @route   POST /api/request-templates
// @access  Private/Admin
const createTemplate = async (req, res) => {
    try {
        const { name, type, subject, body, placeholders } = req.body;

        const templateExists = await RequestTemplate.findOne({ name });

        if (templateExists) {
            return res.status(400).json({ message: 'Template with this name already exists' });
        }

        const template = await RequestTemplate.create({
            name,
            type,
            subject,
            body,
            placeholders,
            createdBy: req.user._id
        });

        res.status(201).json(template);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get all request templates
// @route   GET /api/request-templates
// @access  Private (Admin/User based on needs, filtering handled by query)
const getTemplates = async (req, res) => {
    try {
        const { type, isActive } = req.query;
        const query = {};

        if (type) query.type = type;
        if (isActive !== undefined) query.isActive = isActive === 'true';

        const templates = await RequestTemplate.find(query).sort({ createdAt: -1 });
        res.json(templates);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get template by ID
// @route   GET /api/request-templates/:id
// @access  Private
const getTemplateById = async (req, res) => {
    try {
        const template = await RequestTemplate.findById(req.params.id);

        if (template) {
            res.json(template);
        } else {
            res.status(404).json({ message: 'Template not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Update template
// @route   PUT /api/request-templates/:id
// @access  Private/Admin
const updateTemplate = async (req, res) => {
    try {
        const { name, type, subject, body, placeholders, isActive } = req.body;

        const template = await RequestTemplate.findById(req.params.id);

        if (template) {
            template.name = name || template.name;
            template.type = type || template.type;
            template.subject = subject || template.subject;
            template.body = body || template.body;
            template.placeholders = placeholders || template.placeholders;
            if (isActive !== undefined) template.isActive = isActive;

            const updatedTemplate = await template.save();
            res.json(updatedTemplate);
        } else {
            res.status(404).json({ message: 'Template not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Delete template
// @route   DELETE /api/request-templates/:id
// @access  Private/Admin
const deleteTemplate = async (req, res) => {
    try {
        const template = await RequestTemplate.findById(req.params.id);

        if (template) {
            await template.deleteOne();
            res.json({ message: 'Template removed' });
        } else {
            res.status(404).json({ message: 'Template not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Toggle template active status
// @route   PATCH /api/request-templates/:id/toggle-status
// @access  Private/Admin
const toggleTemplateStatus = async (req, res) => {
    try {
        const template = await RequestTemplate.findById(req.params.id);

        if (template) {
            template.isActive = !template.isActive;
            const updatedTemplate = await template.save();
            res.json(updatedTemplate);
        } else {
            res.status(404).json({ message: 'Template not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export {
    createTemplate,
    getTemplates,
    getTemplateById,
    updateTemplate,
    deleteTemplate,
    toggleTemplateStatus
};
