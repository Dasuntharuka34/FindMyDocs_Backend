import Form from '../models/Form.js';
import FormSubmission from '../models/FormSubmission.js';
import ExcuseRequest from '../models/ExcuseRequest.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Letter from '../models/Letter.js';
import Role from '../models/Role.js';
import mongoose from 'mongoose';

// Internal helper to ensure system forms exist
const seedSystemForms = async (adminId) => {
  const systemForms = [
    { name: 'Medical Certificate', description: 'Request for medical absence excuse' },
    { name: 'Leave Request', description: 'Formal request for leave of absence' },
    { name: 'Transcript Request', description: 'Request for official academic transcript' },
    { name: 'Internship Letter', description: 'Request for internship recommendation or approval' }
  ];

  for (const sf of systemForms) {
    const exists = await Form.findOne({ name: sf.name });
    if (!exists) {
      await Form.create({
        ...sf,
        isSystemForm: true,
        createdBy: adminId || '000000000000000000000000', // Fallback ID if no admin yet
        fields: [] // System forms handle their own fields hardcoded for now
      });
    }
  }
};

// @desc    Get all forms
// @route   GET /api/forms
// @access  Private/Admin
const getForms = async (req, res) => {
  try {
    await seedSystemForms(req.user._id);
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
      if (form.isSystemForm) {
        return res.status(403).json({ message: 'System forms cannot be deleted' });
      }
      await Form.deleteOne({ _id: req.params.id });
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
    // Attempt to seed if called by a user (req.user might be present if protected)
    // If not protected, we use a default ID or skip seeding if it's already done
    await seedSystemForms();

    // Get user role from request (if authenticated)
    const userRole = req.user?.role || 'Student'; // Default to Student if not authenticated

    // Filter forms by enabled status and role visibility
    const forms = await Form.find({
      isEnabled: true,
      visibleToRoles: { $in: [userRole] }
    });

    res.json(forms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get form analytics
// @route   GET /api/forms/analytics
// @access  Private/Admin
const getFormAnalytics = async (req, res) => {
  try {
    // 1. Existing Dynamic Form Analytics
    const formAnalytics = await FormSubmission.aggregate([
      {
        $group: {
          _id: { formId: '$form', status: { $ifNull: ['$status', 'Pending'] } },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'forms',
          localField: '_id.formId',
          foreignField: '_id',
          as: 'formInfo'
        }
      },
      {
        $project: {
          formName: {
            $ifNull: [{ $arrayElemAt: ['$formInfo.name', 0] }, "Unknown Form"]
          },
          status: '$_id.status',
          count: 1,
          _id: 0
        }
      }
    ]);

    // 2. Helper to get hardcoded request analytics
    const getHardcodedAnalytics = async (Model, formName) => {
      return await Model.aggregate([
        {
          $project: {
            normalizedStatus: {
              $cond: {
                if: { $in: ['$status', ['Approved', 'Rejected']] },
                then: '$status',
                else: 'Pending'
              }
            }
          }
        },
        {
          $group: {
            _id: '$normalizedStatus',
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            formName: formName,
            status: '$_id',
            count: 1,
            _id: 0
          }
        }
      ]);
    };

    // 3. Fetch all analytics in parallel
    const [excuseAnalytics, leaveAnalytics, letterAnalytics] = await Promise.all([
      getHardcodedAnalytics(ExcuseRequest, 'Excuse Request'),
      getHardcodedAnalytics(LeaveRequest, 'Leave Request'),
      getHardcodedAnalytics(Letter, 'Letter Request')
    ]);

    // 4. Combine all results
    const consolidatedAnalytics = [
      ...formAnalytics,
      ...excuseAnalytics,
      ...leaveAnalytics,
      ...letterAnalytics
    ];

    console.log(`Consolidated ${consolidatedAnalytics.length} analytics records.`);

    res.json(consolidatedAnalytics);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching consolidated analytics', error: error.message });
  }
};

// @desc    Archive a form and create a new version
// @route   POST /api/forms/:id/version
// @access  Private/Admin
const createNewVersion = async (req, res) => {
  try {
    const oldForm = await Form.findById(req.params.id);
    if (!oldForm) return res.status(404).json({ message: 'Form not found' });

    // Archive old form
    oldForm.isArchived = true;
    oldForm.isEnabled = false;
    await oldForm.save();

    // Create new version
    const newForm = new Form({
      name: `${oldForm.name} (v${oldForm.version + 1})`,
      description: oldForm.description,
      fields: oldForm.fields,
      version: oldForm.version + 1,
      createdBy: req.user._id,
      isEnabled: true
    });

    await newForm.save();
    res.status(201).json(newForm);
  } catch (error) {
    res.status(500).json({ message: 'Error creating new version', error: error.message });
  }
};

// @desc    Update form role visibility
// @route   PUT /api/forms/:id/roles
// @access  Private/Admin
const updateFormRoles = async (req, res) => {
  try {
    const { visibleToRoles } = req.body;
    const form = await Form.findById(req.params.id);

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    // Get all valid roles from database
    const validRolesData = await Role.find().select('name');
    const validRoles = validRolesData.map(role => role.name);
    
    // Validate roles
    const invalidRoles = visibleToRoles.filter(role => !validRoles.includes(role));

    if (invalidRoles.length > 0) {
      return res.status(400).json({ message: `Invalid roles: ${invalidRoles.join(', ')}` });
    }

    form.visibleToRoles = visibleToRoles;
    const updatedForm = await form.save();

    res.json(updatedForm);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get available roles for form visibility
// @route   GET /api/forms/roles/available
// @access  Private/Admin
const getAvailableRoles = async (req, res) => {
  try {
    // Get all available roles from the Role collection
    const roles = await Role.find().select('name').sort({ name: 1 });
    const roleNames = roles.map(role => role.name);
    res.json(roleNames);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export {
  getForms,
  getFormById,
  createForm,
  updateForm,
  deleteForm,
  updateFormStatus,
  getAvailableForms,
  getFormAnalytics,
  createNewVersion,
  updateFormRoles,
  getAvailableRoles
};