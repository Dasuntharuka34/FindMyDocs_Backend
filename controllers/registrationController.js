import bcrypt from 'bcryptjs';
import Registration from '../models/Registration.js';

// @desc    Get all pending registrations
// @route   GET /api/registrations/pending
// @access  Private/Admin
const getPendingRegistrations = async (req, res) => {
  try {
    // Assuming 'status' field will be used if you expand the registration schema
    // For now, we fetch all from the Registration collection as they are implicitly "pending"
    const registrations = await Registration.find({});
    res.json(registrations);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pending registrations', error: error.message });
  }
};

// @desc    Create a new registration (when a user signs up initially)
// @route   POST /api/registrations
// @access  Public
const createRegistration = async (req, res) => {
  const { name, email, nic, mobile, password, role, indexNumber, department } = req.body;

  try {
    const registrationExists = await Registration.findOne({ email });
    if (registrationExists) {
      return res.status(400).json({ message: 'An application with this email already exists' });
    }

    // Hash the password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const registration = await Registration.create({
      name,
      email,
      nic,
      mobile,
      password: hashedPassword,
      role,
      indexNumber: role === 'Student' ? indexNumber : undefined,
      department,
    });

    if (registration) {
      res.status(201).json({
        _id: registration._id,
        name: registration.name,
        email: registration.email,
        nic: registration.nic,
        mobile: registration.mobile,
        role: registration.role,
        department:registration.department,
        message: 'Registration submitted successfully. Awaiting admin approval.',
      });
    } else {
      res.status(400).json({ message: 'Invalid registration data' });
    }

    // ... rest of the function
  } catch (error) {
    res.status(500).json({ message: 'Error creating registration', error: error.message });
  }
};

// @desc    Delete a registration (after approval or rejection)
// @route   DELETE /api/registrations/:id
// @access  Private/Admin
const deleteRegistration = async (req, res) => {
  const { id } = req.params;

  try {
    const registration = await Registration.findById(id);

    if (registration) {
      await registration.deleteOne();
      res.json({ message: 'Registration removed' });
    } else {
      res.status(404).json({ message: 'Registration not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error deleting registration', error: error.message });
  }
};

export { createRegistration, deleteRegistration, getPendingRegistrations };

