import bcrypt from 'bcryptjs';
import Registration from '../models/Registration.js';
import SystemConfig from '../models/SystemConfig.js';
import { sendRegistrationEmail } from '../utils/mailService.js';

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
    // Check if registration is allowed
    const signupConfig = await SystemConfig.findOne({ key: 'ALLOW_NEW_REGISTRATIONS' });
    if (signupConfig && signupConfig.value === false) {
      return res.status(403).json({ message: 'Registrations are currently disabled by administrator' });
    }

    const registrationExists = await Registration.findOne({ email });
    if (registrationExists) {
      return res.status(400).json({ message: 'An application with this email already exists' });
    }

    const nicExists = await Registration.findOne({ nic });
    if (nicExists) {
      return res.status(400).json({ message: 'An application with this NIC already exists' });
    }

    const mobileExists = await Registration.findOne({ mobile });
    if (mobileExists) {
      return res.status(400).json({ message: 'An application with this mobile number already exists' });
    }

    // Hash the password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const registration = new Registration({
      name,
      email,
      nic,
      mobile,
      password: hashedPassword,
      role,
      indexNumber: role === 'Student' ? indexNumber : undefined,
      department,
    });

    await registration.save();

    // Send registration email
    try {
      await sendRegistrationEmail(registration.email, registration.name);
    } catch (emailError) {
      console.error('Error sending registration email:', emailError);
      // Note: We don't fail the registration if email fails, but log the error
    }

    res.status(201).json({
      message: 'Registration submitted successfully. Please wait for admin approval.',
    });

  } catch (error) {
    res.status(500).json({ message: 'Error creating registration', error: error.message });
  }
};

// @desc    Delete a registration
// @route   DELETE /api/registrations/:id
// @access  Private/Admin
const deleteRegistration = async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.id);

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

