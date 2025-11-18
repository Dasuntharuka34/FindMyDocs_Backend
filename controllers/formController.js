import Form from '../models/Form.js';

// @desc    Get all forms
// @route   GET /api/forms
// @access  Private/Admin
const getForms = async (req, res) => {
  try {
    const forms = await Form.find({}).populate('createdBy', 'name');
    res.json(forms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single form
// @route   GET /api/forms/:id
// @access  Public
const getFormById = async (req, res) => {
  try {
    const form = await Form.findById(req.params.id);
    if (form) {
      res.json(form);
    } else {
      res.status(404).json({ message: 'Form not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a form
// @route   POST /api/forms
// @access  Private/Admin
const createForm = async (req, res) => {
  try {
    const { name, description, fields } = req.body;
    const form = new Form({
      name,
      description,
      fields,
      createdBy: req.user._id,
    });
    const createdForm = await form.save();
    res.status(201).json(createdForm);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update a form
// @route   PUT /api/forms/:id
// @access  Private/Admin
const updateForm = async (req, res) => {
  try {
    const { name, description, fields } = req.body;
    const form = await Form.findById(req.params.id);

    if (form) {
      form.name = name;
      form.description = description;
      form.fields = fields;
      const updatedForm = await form.save();
      res.json(updatedForm);
    } else {
      res.status(404).json({ message: 'Form not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete a form
// @route   DELETE /api/forms/:id
// @access  Private/Admin
const deleteForm = async (req, res) => {
  try {
    const form = await Form.findById(req.params.id);
    if (form) {
      await form.remove();
      res.json({ message: 'Form removed' });
    } else {
      res.status(404).json({ message: 'Form not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update form status
// @route   PUT /api/forms/:id/status
// @access  Private/Admin
const updateFormStatus = async (req, res) => {
  try {
    const form = await Form.findById(req.params.id);

    if (form) {
      form.isEnabled = req.body.isEnabled;
      const updatedForm = await form.save();
      res.json(updatedForm);
    } else {
      res.status(404).json({ message: 'Form not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all enabled forms
// @route   GET /api/forms/available
// @access  Public
const getAvailableForms = async (req, res) => {
  try {
    const forms = await Form.find({ isEnabled: true });
    res.json(forms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export { getForms, getFormById, createForm, updateForm, deleteForm, updateFormStatus, getAvailableForms };