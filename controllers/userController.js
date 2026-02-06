import { sendEmail } from '../utils/mailService.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Registration from '../models/Registration.js';
import { uploadToBlob } from '../config/vercelBlob.js';
import ExcuseRequest from '../models/ExcuseRequest.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Letter from '../models/Letter.js';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { logAuditAction } from './auditController.js';
import { logSecurityEvent } from '../utils/securityLogger.js';

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
    // Check if new registrations are allowed
    const SystemConfig = (await import('../models/SystemConfig.js')).default;
    const allowRegistrationsConfig = await SystemConfig.findOne({ key: 'ALLOW_NEW_REGISTRATIONS' });

    if (allowRegistrationsConfig && allowRegistrationsConfig.value === false) {
      return res.status(403).json({
        message: 'New registrations are currently disabled. Please contact the administrator.',
        registrationsClosed: true
      });
    }

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
      // Send a confirmation email
      const emailOptions = {
        to: email,
        subject: 'Registration Submitted Successfully',
        html: `
          <h1>Welcome, ${name}!</h1>
          <p>Your registration request has been submitted successfully.</p>
          <p>Your account is now pending admin approval. You will be notified via email once your account is approved.</p>
          <p>Thank you for joining FindMyDocs!</p>
        `,
      };
      await sendEmail(emailOptions);

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
  const { nic, password } = req.body;

  try {
    const user = await User.findOne({ nic });

    if (!user) {
      await logSecurityEvent({
        eventType: 'LOGIN_FAILED',
        userNic: nic,
        reason: 'User not found'
      }, req);
      return res.status(401).json({ message: 'Invalid NIC or password' });
    }

    // Compare plain password with hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await logSecurityEvent({
        eventType: 'LOGIN_FAILED',
        userId: user._id,
        userEmail: user.email,
        userNic: nic,
        reason: 'Invalid password'
      }, req);
      return res.status(401).json({ message: 'Invalid NIC or password' });
    }

    // Check maintenance mode - block non-admin users
    const SystemConfig = (await import('../models/SystemConfig.js')).default;
    const maintenanceMode = await SystemConfig.findOne({ key: 'MAINTENANCE_MODE' });

    if (maintenanceMode && maintenanceMode.value === true) {
      // Allow admins to login during maintenance
      if (!user.role || user.role.toLowerCase() !== 'admin') {
        await logSecurityEvent({
          eventType: 'LOGIN_BLOCKED',
          userId: user._id,
          userEmail: user.email,
          userNic: nic,
          reason: 'Maintenance mode active'
        }, req);
        return res.status(503).json({
          message: 'System is currently under maintenance. Please try again later.',
          maintenance: true
        });
      }
    }

    const token = generateToken(user._id);

    await logSecurityEvent({
      eventType: 'LOGIN_SUCCESS',
      userId: user._id,
      userEmail: user.email,
      userNic: nic,
      success: true
    }, req);

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

    // Send approval email
    const approvalEmailOptions = {
      to: newUser.email,
      subject: 'Your Registration Has Been Approved!',
      html: `
        <h1>Congratulations, ${newUser.name}!</h1>
        <p>Your registration request for FindMyDocs has been approved by the administrator.</p>
        <p>You can now log in to your account using your credentials.</p>
        <p>Thank you for joining FindMyDocs!</p>
      `,
    };
    await sendEmail(approvalEmailOptions);

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

  const { name, mobile, department, email, role, indexNumber, nic } = req.body;

  // Handle profile picture - upload to Vercel Blob Storage if file is uploaded
  let profilePictureData = null;
  if (req.file) {
    try {
      // Create unique filename
      const timestamp = Date.now();
      const filename = `profile-${id}-${timestamp}.${req.file.originalname.split('.').pop()}`;

      // Upload to Vercel Blob Storage
      const filenameWithFolder = `profile/${filename}`;
      const url = await uploadToBlob(req.file.buffer, filenameWithFolder, {
        contentType: req.file.mimetype,
      });

      profilePictureData = url;
    } catch (uploadError) {
      console.error('Error uploading to Vercel Blob:', uploadError);
      return res.status(500).json({ message: 'Error uploading profile picture', error: uploadError.message });
    }
  }

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Authorization check: only admin or the user themselves can update
    const isAdmin = req.user.role.toLowerCase() === 'admin';
    if (!isAdmin && req.user._id.toString() !== id) {
      return res.status(403).json({ message: 'Forbidden: You are not authorized to update this profile.' });
    }

    // Check for mobile duplicates
    if (mobile && mobile !== user.mobile) {
      const mobileExists = await User.findOne({ mobile });
      if (mobileExists && mobileExists._id.toString() !== user._id.toString()) {
        return res.status(400).json({ message: 'Mobile number already in use by another account.' });
      }
    }

    // Check for email duplicates (Admin only fields)
    if (email && email !== user.email) {
      if (!isAdmin) {
        return res.status(403).json({ message: 'Only administrators can change email addresses.' });
      }
      const emailExists = await User.findOne({ email });
      if (emailExists && emailExists._id.toString() !== user._id.toString()) {
        return res.status(400).json({ message: 'Email address already in use by another account.' });
      }
      user.email = email;
    }

    // Check for NIC duplicates (Admin only fields)
    if (nic && nic !== user.nic) {
      if (!isAdmin) {
        return res.status(403).json({ message: 'Only administrators can change NIC numbers.' });
      }
      const nicExists = await User.findOne({ nic });
      if (nicExists && nicExists._id.toString() !== user._id.toString()) {
        return res.status(400).json({ message: 'NIC number already in use by another account.' });
      }
      user.nic = nic;
    }

    // Update other fields
    user.name = name || user.name;
    user.mobile = mobile || user.mobile;
    user.department = department || user.department;

    if (isAdmin) {
      user.role = role || user.role;
      user.indexNumber = indexNumber || user.indexNumber;
    }

    if (profilePictureData) {
      user.profilePicture = profilePictureData;
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
// @desc    Bulk import users from CSV
// @route   POST /api/users/bulk-import
// @access  Private/Admin
const bulkImportUsers = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const results = [];
  const errors = [];
  let successCount = 0;

  try {
    const stream = Readable.from(req.file.buffer.toString());

    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        for (const row of results) {
          try {
            // Validate required fields
            if (!row.name || !row.email || !row.nic || !row.role) {
              errors.push({ email: row.email, error: 'Missing required fields' });
              continue;
            }

            // Check if user exists
            const userExists = await User.findOne({
              $or: [{ email: row.email }, { nic: row.nic }]
            });

            if (userExists) {
              errors.push({ email: row.email, error: 'User already exists' });
              continue;
            }

            // Create user
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(row.password || 'password123', salt);

            await User.create({
              name: row.name,
              email: row.email,
              nic: row.nic,
              mobile: row.mobile,
              role: row.role,
              department: row.department,
              indexNumber: row.indexNumber,
              password: hashedPassword,
            });

            successCount++;
          } catch (err) {
            errors.push({ email: row.email, error: err.message });
          }
        }

        await logAuditAction(
          req.user._id,
          req.user.name,
          'BULK_OPERATION',
          'User',
          null,
          'Bulk User Import',
          { successCount, errorCount: errors.length },
          { errors },
          req
        );

        res.json({
          message: `Import processed. Success: ${successCount}, Failed: ${errors.length}`,
          errors: errors.length > 0 ? errors : undefined,
          successCount
        });
      });
  } catch (error) {
    console.error('Error in bulk import:', error);
    res.status(500).json({ message: 'Error processing import', error: error.message });
  }
};

// @desc    Bulk delete users
// @route   POST /api/users/bulk-delete
// @access  Private/Admin
const bulkDeleteUsers = async (req, res) => {
  const { userIds } = req.body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ message: 'No users selected' });
  }

  try {
    const result = await User.deleteMany({ _id: { $in: userIds } });

    await logAuditAction(
      req.user._id,
      req.user.name,
      'BULK_OPERATION',
      'User',
      null,
      'Bulk User Delete',
      { count: result.deletedCount, userIds },
      {},
      req
    );

    res.json({ message: `Successfully deleted ${result.deletedCount} users` });
  } catch (error) {
    console.error('Error in bulk delete:', error);
    res.status(500).json({ message: 'Error deleting users', error: error.message });
  }
};

// @desc    Bulk reset passwords
// @route   POST /api/users/bulk-reset-password
// @access  Private/Admin
const bulkResetPasswords = async (req, res) => {
  const { userIds, newPassword } = req.body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ message: 'No users selected' });
  }

  try {
    // Get default password from system config
    const SystemConfig = (await import('../models/SystemConfig.js')).default;
    const defaultPasswordConfig = await SystemConfig.findOne({ key: 'DEFAULT_PASSWORD' });
    const defaultPassword = defaultPasswordConfig?.value || 'password123';

    const passwordToSet = newPassword || defaultPassword;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passwordToSet, salt);

    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { password: hashedPassword } }
    );

    await logAuditAction(
      req.user._id,
      req.user.name,
      'BULK_OPERATION',
      'User',
      null,
      'Bulk Password Reset',
      { count: result.modifiedCount, userIds },
      {},
      req
    );

    res.json({
      message: `Successfully reset passwords for ${result.modifiedCount} users`,
      count: result.modifiedCount
    });
  } catch (error) {
    console.error('Error in bulk password reset:', error);
    res.status(500).json({ message: 'Error resetting passwords', error: error.message });
  }
};

// @desc    Bulk update roles
// @route   POST /api/users/bulk-update-roles
// @access  Private/Admin
const bulkUpdateRoles = async (req, res) => {
  const { userIds, role } = req.body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !role) {
    return res.status(400).json({ message: 'Invalid request parameters' });
  }

  try {
    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { role } }
    );

    await logAuditAction(
      req.user._id,
      req.user.name,
      'BULK_OPERATION',
      'User',
      null,
      'Bulk Role Update',
      { count: result.modifiedCount, role, userIds },
      {},
      req
    );

    res.json({ message: `Successfully updated roles for ${result.modifiedCount} users` });
  } catch (error) {
    console.error('Error in bulk role update:', error);
    res.status(500).json({ message: 'Error updating roles', error: error.message });
  }
};

// @desc    Get user activity history
// @route   GET /api/users/:id/activity
// @access  Private/Admin
const getUserActivityHistory = async (req, res) => {
  const { id } = req.params;

  try {
    // This assumes we implement AuditLog or check individual request collections
    // For now, let's aggregate from request collections as a start, or use AuditLog if populated
    // Since AuditLog is new, we might check both or just requests for now

    // Check if AuditLog model exists/is imported. It is not imported at top level yet, need check.
    // Ideally AuditLog should be used.

    // For now, let's fetch requests (Excuse, Leave, Letter) submitted by this user
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Since we don't have a unified "Activity" model besides the new AuditLog (which is empty for past events),
    // we'll fetch from requests.
    const [excuseRequests, leaveRequests, letters] = await Promise.all([
      ExcuseRequest.find({ studentName: user.name }).sort({ submittedDate: -1 }),
      LeaveRequest.find({ studentName: user.name }).sort({ submittedDate: -1 }),
      Letter.find({ student: user.name }).sort({ submittedDate: -1 })
    ]);

    const activity = [
      ...excuseRequests.map(r => ({ type: 'Excuse Request', date: r.submittedDate, details: r.reason, status: r.status })),
      ...leaveRequests.map(r => ({ type: 'Leave Request', date: r.submittedDate, details: r.reason, status: r.status })),
      ...letters.map(r => ({ type: 'Letter Request', date: r.submittedDate, details: r.reason, status: r.status }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(activity);
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ message: 'Error fetching activity', error: error.message });
  }
};

// @desc    Toggle user active status
// @route   PUT /api/users/:id/toggle-status
// @access  Private/Admin
const toggleUserStatus = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Toggle logic (assuming isActive field exists, if not default to true)
    const newStatus = user.isActive === false ? true : false;
    user.isActive = newStatus;
    await user.save();

    await logAuditAction(
      req.user._id,
      req.user.name,
      'USER_STATUS_CHANGED',
      'User',
      id,
      user.name,
      { isActive: newStatus },
      {},
      req
    );

    res.json({ message: `User ${user.name} is now ${newStatus ? 'Active' : 'Suspended'}`, isActive: newStatus });
  } catch (error) {
    console.error('Error toggling user status:', error);
    res.status(500).json({ message: 'Error updating user status', error: error.message });
  }
};

// @desc    Advanced user search
// @route   POST /api/users/search
// @access  Private/Admin
const searchUsers = async (req, res) => {
  const { query, role, department, status } = req.body;

  try {
    const searchCriteria = {};

    if (query) {
      searchCriteria.$or = [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { nic: { $regex: query, $options: 'i' } }
      ];
    }

    if (role) searchCriteria.role = role;
    if (department) searchCriteria.department = department;
    if (status !== undefined) searchCriteria.isActive = status;

    const users = await User.find(searchCriteria).select('-password');
    res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Error searching users', error: error.message });
  }
};

export {
  approveRegistration,
  authUser,
  changePassword,
  createUser,
  deleteUser,
  getAllPendingRequests,
  getPendingRegistrations,
  getUsers,
  registerUser,
  rejectRegistration,
  resetUserPassword,
  updateUser,
  bulkImportUsers,
  bulkDeleteUsers,
  bulkResetPasswords,
  bulkUpdateRoles,
  getUserActivityHistory,
  toggleUserStatus,
  searchUsers
};

