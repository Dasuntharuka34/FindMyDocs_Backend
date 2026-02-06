import FormTemplate from '../models/FormTemplate.js';

// @desc    Get all form templates
// @route   GET /api/form-templates
// @access  Private/Admin
const getTemplates = async (req, res) => {
    try {
        const templates = await FormTemplate.find().sort({ name: 1 });
        res.json(templates);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching templates', error: error.message });
    }
};

// @desc    Create a new form template
// @route   POST /api/form-templates
// @access  Private/Admin
const createTemplate = async (req, res) => {
    try {
        const { name, description, fields, category } = req.body;
        const template = await FormTemplate.create({
            name,
            description,
            fields,
            category
        });
        res.status(201).json(template);
    } catch (error) {
        res.status(500).json({ message: 'Error creating template', error: error.message });
    }
};

// @desc    Delete a form template
// @route   DELETE /api/form-templates/:id
// @access  Private/Admin
const deleteTemplate = async (req, res) => {
    try {
        await FormTemplate.findByIdAndDelete(req.params.id);
        res.json({ message: 'Template deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting template', error: error.message });
    }
};

export {
    getTemplates,
    createTemplate,
    deleteTemplate
};
