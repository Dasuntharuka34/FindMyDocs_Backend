import FormSubmission from '../models/FormSubmission.js';
import LeaveRequest from '../models/LeaveRequest.js';
import ExcuseRequest from '../models/ExcuseRequest.js';
import User from '../models/User.js';

// @desc    Generate a report based on submissions, requests, and users
// @route   POST /api/reports/generate
// @access  Private/Admin
const generateReport = async (req, res) => {
  try {
    const { startDate, endDate, reportType } = req.body;

    console.log('Report Request Received:');
    console.log('  startDate:', startDate);
    console.log('  endDate:', endDate);
    console.log('  reportType:', reportType);

    let data = {};

    const hasDateFilter = (startDate && startDate.trim() !== '') || (endDate && endDate.trim() !== '');
    console.log('  hasDateFilter:', hasDateFilter);

    const dateFilter = {};
    if (startDate && startDate.trim() !== '') {
      dateFilter.$gte = new Date(startDate);
      console.log('  dateFilter.$gte:', dateFilter.$gte);
    }
    if (endDate && endDate.trim() !== '') {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Set to the end of the day
      dateFilter.$lte = end;
      console.log('  dateFilter.$lte:', dateFilter.$lte);
    }

    const queryFilter = hasDateFilter ? { createdAt: dateFilter } : {};
    console.log('  Query Filter:', JSON.stringify(queryFilter));

    switch (reportType) {
      case 'all':
        const formSubmissions = await FormSubmission.find(hasDateFilter ? { createdAt: dateFilter } : {}).populate('user', 'name regNumber');
        const leaveRequests = await LeaveRequest.find(hasDateFilter ? { createdAt: dateFilter } : {}).populate('user', 'name regNumber');
        const excuseRequests = await ExcuseRequest.find(hasDateFilter ? { createdAt: dateFilter } : {}).populate('user', 'name regNumber');
        data = { formSubmissions, leaveRequests, excuseRequests };
        break;
      case 'users':
        const users = await User.find(hasDateFilter ? { createdAt: dateFilter } : {}).select('-password');
        data = { users };
        break;
      case 'formSubmissions':
        data = await FormSubmission.find(hasDateFilter ? { createdAt: dateFilter } : {}).populate('user', 'name regNumber');
        break;
      case 'leaveRequests':
        data = await LeaveRequest.find(hasDateFilter ? { createdAt: dateFilter } : {}).populate('user', 'name regNumber');
        break;
      case 'excuseRequests':
        data = await ExcuseRequest.find(hasDateFilter ? { createdAt: dateFilter } : {}).populate('user', 'name regNumber');
        break;
      default:
        return res.status(400).json({ message: 'Invalid report type' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export {
  generateReport,
};
