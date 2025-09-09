import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import ExcuseRequest from '../models/ExcuseRequest.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Letter from '../models/Letter.js';
import Registration from '../models/Registration.js';
import User from '../models/User.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {

    expiresIn: '1h',
  });
};


// @desc    Register a new user (Creates a pending registration request)
// @route   POST /api/users/register
// @access  Public
const registerUser = async (req, res) => {
  const { name, email, nic, password, role, department, indexNumber, mobile } = req.body;

  try {
    // Check if user/registration exists by email, NIC, or mobile
    const userExistsByEmail = await User.findOne({ email });
    const userExistsByNic = await User.findOne({ nic });
    const userExistsByMobile = await User.findOne({ mobile });

    const registrationPendingByEmail = await Registration.findOne({ email, status: 'pending' });
    const registrationPendingByNic = await Registration.findOne({ nic, status: 'pending' });
    const registrationPendingByMobile = await Registration.findOne({ mobile, status: 'pending' });

    if (userExistsByEmail) {
      return res.status(400).json({ message: 'User with this email is already registered.' });
    }
    if (userExistsByNic) {
      return res.status(400).json({ message: 'User with this NIC is already registered.' });
    }
    if (userExistsByMobile) {
      return res.status(400).json({ message: 'User with this mobile number is already registered.' });
    }
    if (registrationPendingByEmail) {
      return res.status(400).json({ message: 'A registration request with this email is already pending admin approval.' });
    }
    if (registrationPendingByNic) {
      return res.status(400).json({ message: 'A registration request with this NIC is already pending admin approval.' });
    }
    if (registrationPendingByMobile) {
      return res.status(400).json({ message: 'A registration request with this mobile number is already pending admin approval.' });
    }

    // Hash the password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create a new registration request in the Registration collection
    const registration = await Registration.create({
      name,
      email,
      nic,
      mobile,
      password: hashedPassword,
      role,
      department,
      indexNumber: role === 'Student' ? indexNumber : undefined,
      profilePicture: null,
      status: 'pending',
    });

    if (registration) {
      res.status(201).json({
        message: 'Registration request submitted successfully! Your account is pending admin approval.',
        status: 'pending',
      });
    } else {
      res.status(400).json({ message: 'Invalid registration data.' });
    }
  } catch (error) {
    console.error('Error during user registration request:', error);
    res.status(500).json({ message: 'Server error during registration request.', error: error.message });
  }
};


// @desc    Authenticate user & get token (User Login)
// @route   POST /api/users/login
// @access  Public
const authUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Compare plain password with hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user._id);

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        nic: user.nic,
        mobile: user.mobile,
        role: user.role,
        department: user.department,
        indexNumber: user.indexNumber,
        profilePicture: user.profilePicture,
      },
      token,
      message: 'Login successful',
    });

  } catch (error) {
    console.error('Error during authentication:', error);
    res.status(500).json({ message: 'Server error during login', error: error.message });
  }
};

// @desc    Get all approved users (for Admin dashboard)
// @route   GET /api/users
// @access  Private/Admin
const getUsers = async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

// @desc    Create a new user (Admin)
// @route   POST /api/users
// @access  Private/Admin
const createUser = async (req, res) => {
  const { name, email, nic, mobile, password, role, indexNumber, department } = req.body;

  try {
    const userExistsByEmail = await User.findOne({ email });
    const userExistsByNic = await User.findOne({ nic });
    const userExistsByMobile = await User.findOne({ mobile });

    if (userExistsByEmail) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    if (userExistsByNic) {
      return res.status(400).json({ message: 'User with this NIC already exists' });
    }
    if (userExistsByMobile) {
      return res.status(400).json({ message: 'User with this mobile number already exists' });
    }

    // Hash the password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      nic,
      mobile,
      password: hashedPassword,
      role,
      indexNumber: role === 'Student' ? indexNumber : undefined,
      department,
      profilePicture: null,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        nic: user.nic,
        mobile: user.mobile,
        role: user.role,
        profilePicture: user.profilePicture,
        message: 'User created successfully by admin',
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
};

// @desc    Get all pending registration requests (for Admin dashboard)
// @route   GET /api/users/registrations/pending
// @access  Private/Admin
const getPendingRegistrations = async (req, res) => {
  try {
    const pendingRequests = await Registration.find({ status: 'pending' });
    res.json(pendingRequests);
  } catch (error) {
    console.error('Error fetching pending registrations:', error);
    res.status(500).json({ message: 'Error fetching pending registrations', error: error.message });
  }
};

// @desc    Approve a registration request
// @route   POST /api/users/registrations/:id/approve
// @access  Private/Admin
const approveRegistration = async (req, res) => {
  const { id } = req.params;

  try {
    const registration = await Registration.findById(id);

    if (!registration) {
      return res.status(404).json({ message: 'Registration request not found.' });
    }
    if (registration.status !== 'pending') {
      return res.status(400).json({ message: 'Registration is not in pending status.' });
    }

    // Check for duplicates before creating
    const userExistsByEmail = await User.findOne({ email: registration.email });
    const userExistsByNic = await User.findOne({ nic: registration.nic });
    const userExistsByMobile = await User.findOne({ mobile: registration.mobile });

    if (userExistsByEmail) {
      return res.status(400).json({ message: 'A user with this email already exists. Cannot approve duplicate.' });
    }
    if (userExistsByNic) {
      return res.status(400).json({ message: 'A user with this NIC already exists. Cannot approve duplicate.' });
    }
    if (userExistsByMobile) {
      return res.status(400).json({ message: 'A user with this mobile number already exists. Cannot approve duplicate.' });
    }

    const newUser = await User.create({
      name: registration.name,
      email: registration.email,
      nic: registration.nic,
      mobile: registration.mobile,
      password: registration.password,
      role: registration.role,
      department: registration.department,
      indexNumber: registration.indexNumber,
      profilePicture: registration.profilePicture,
    });

    await Registration.findByIdAndDelete(id);

    res.status(200).json({ message: `User ${newUser.email} approved and created successfully.` });

  } catch (error) {
    console.error('Error approving registration:', error);
    res.status(500).json({ message: 'Server error during registration approval.', error: error.message });
  }
};

// @desc    Reject a registration request
// @route   DELETE /api/users/registrations/:id/reject
// @access  Private/Admin
const rejectRegistration = async (req, res) => {
  const { id } = req.params;

  try {
    const registration = await Registration.findById(id);

    if (!registration) {
      return res.status(404).json({ message: 'Registration request not found.' });
    }
    if (registration.status !== 'pending') {
      return res.status(400).json({ message: 'Registration is not in pending status.' });
    }

    await Registration.findByIdAndDelete(id);

    res.status(200).json({ message: `Registration request for ${registration.email} rejected and removed.` });

  } catch (error) {
    console.error('Error rejecting registration:', error);
    res.status(500).json({ message: 'Server error during registration rejection.', error: error.message });
  }
};

// @desc    Update a user profile
// @route   PUT /api/users/:id
// @access  Private/User
const updateUser = async (req, res) => {
  const { id } = req.params;

  const { name, email, nic, mobile, department, indexNumber } = req.body;
  const profilePicturePath = req.file ? `/uploads/profile_pictures/${req.file.filename}` : null;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check for email/nic/mobile duplicates
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists && emailExists._id.toString() !== user._id.toString()) {
        return res.status(400).json({ message: 'Email already in use by another account.' });
      }
    }
    if (nic && nic !== user.nic) {
      const nicExists = await User.findOne({ nic });
      if (nicExists && nicExists._id.toString() !== user._id.toString()) {
        return res.status(400).json({ message: 'NIC already in use by another account.' });
      }
    }
    if (mobile && mobile !== user.mobile) {
      const mobileExists = await User.findOne({ mobile });
      if (mobileExists && mobileExists._id.toString() !== user._id.toString()) {
        return res.status(400).json({ message: 'Mobile number already in use by another account.' });
      }
    }

    user.name = name || user.name;
    user.email = email || user.email;
    user.nic = nic || user.nic;
    user.mobile = mobile || user.mobile;
    user.department = department || user.department;

    if (user.role === 'Student') {
      user.indexNumber = indexNumber || user.indexNumber;
    } else {
      user.indexNumber = undefined;
    }

    if (profilePicturePath) {
      user.profilePicture = profilePicturePath;
    } else if (req.body.removeProfilePicture === 'true') {
      user.profilePicture = null;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      nic: updatedUser.nic,
      mobile: updatedUser.mobile,
      role: updatedUser.role,
      department: updatedUser.department,
      indexNumber: updatedUser.indexNumber,
      profilePicture: updatedUser.profilePicture,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Server error updating profile', error: error.message });
  }
};

// @desc    Delete a user (existing, approved user)
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findByIdAndDelete(id);

    if (user) {
      res.json({ message: 'User removed successfully' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
};

// @desc    Reset a user's password to a default value (Admin function)
// @route   PUT /api/users/:id/reset-password
// @access  Private/Admin
const resetUserPassword = async (req, res) => {
  const { id } = req.params; // User ID
  const defaultPassword = 'password123'; // Define your default password here

  try {
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Hash the default password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(defaultPassword, salt);

    await user.save(); // Save the updated user with the new hashed password

    res.status(200).json({ message: `Password for user ${user.email} has been reset to default.` });

  } catch (error) {
    console.error('Error resetting user password:', error);
    res.status(500).json({ message: 'Server error resetting password', error: error.message });
  }
};


// @desc    Change a user's own password
// @route   PUT /api/users/:id/change-password
// @access  Private
const changePassword = async (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword, confirmNewPassword } = req.body;

  // Basic validation
  if (!currentPassword || !newPassword || !confirmNewPassword) {
    return res.status(400).json({ message: 'Please provide all required fields.' });

  }

  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ message: 'New password and confirmation do not match.' });
  }

  try {
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Compare current plain password with hashed password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid old password.' });
    }

    // Hash new password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedNewPassword;
    await user.save();

    res.status(200).json({ message: 'Password changed successfully.' });

  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Server error changing password.', error: error.message });
  }
};


// @desc    Get all pending requests for admin (excuse, leave, letter)
// @route   GET /api/users/pendingRequests
// @access  Private/Admin
const getAllPendingRequests = async (req, res) => {
  try {
    const pendingStatuses = [
      'Pending Lecturer Approval',
      'Pending HOD Approval',
      'Pending Dean Approval',
      'Pending VC Approval'
    ];

    const [excuseRequests, leaveRequests, letters] = await Promise.all([
      ExcuseRequest.find({ status: { $in: pendingStatuses } }),
      LeaveRequest.find({ status: { $in: pendingStatuses } }),
      Letter.find({ status: { $in: pendingStatuses } })
    ]);

    const allPendingRequests = [
      ...excuseRequests.map(req => ({ ...req.toObject(), type: 'excuse' })),
      ...leaveRequests.map(req => ({ ...req.toObject(), type: 'leave' })),
      ...letters.map(req => ({ ...req.toObject(), type: 'letter' }))
    ];

    res.json(allPendingRequests);
  } catch (error) {
    console.error('Error fetching all pending requests:', error);
    res.status(500).json({ message: 'Error fetching all pending requests', error: error.message });
  }
};

// Export all controller functions for use in routes
export { approveRegistration, authUser, changePassword, createUser, deleteUser, getAllPendingRequests, getPendingRegistrations, getUsers, registerUser, rejectRegistration, resetUserPassword, updateUser };

