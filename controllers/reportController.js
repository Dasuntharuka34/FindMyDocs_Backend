import FormSubmission from '../models/FormSubmission.js';
import LeaveRequest from '../models/LeaveRequest.js';
import ExcuseRequest from '../models/ExcuseRequest.js';
import User from '../models/User.js';
import ScheduledReport from '../models/ScheduledReport.js';
import mongoose from 'mongoose';

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
        // FormSubmission uses 'submittedAt'
        const formSubmissions = await FormSubmission.find(hasDateFilter ? { submittedAt: dateFilter } : {}).populate('submittedBy', 'name indexNumber');
        // LeaveRequest uses 'submittedAt'
        const leaveRequests = await LeaveRequest.find(hasDateFilter ? { submittedAt: dateFilter } : {});
        // ExcuseRequest uses 'submittedDate'
        const excuseRequests = await ExcuseRequest.find(hasDateFilter ? { submittedDate: dateFilter } : {});
        data = { formSubmissions, leaveRequests, excuseRequests };
        break;
      case 'users':
        // User has timestamps, so createdAt exists
        const users = await User.find(hasDateFilter ? { createdAt: dateFilter } : {}).select('-password');
        data = { users };
        break;
      case 'formSubmissions':
        data = await FormSubmission.find(hasDateFilter ? { submittedAt: dateFilter } : {}).populate('submittedBy', 'name indexNumber');
        break;
      case 'leaveRequests':
        data = await LeaveRequest.find(hasDateFilter ? { submittedAt: dateFilter } : {});
        break;
      case 'excuseRequests':
        data = await ExcuseRequest.find(hasDateFilter ? { submittedDate: dateFilter } : {});
        break;
      case 'approvedRequests':
        const approvedForms = await FormSubmission.find({
          status: 'Approved',
          ...(hasDateFilter ? { submittedAt: dateFilter } : {})
        }).populate('submittedBy', 'name indexNumber');
        const approvedLeaves = await LeaveRequest.find({
          status: 'Approved',
          ...(hasDateFilter ? { submittedAt: dateFilter } : {})
        });
        const approvedExcuses = await ExcuseRequest.find({
          status: 'Approved',
          ...(hasDateFilter ? { submittedDate: dateFilter } : {})
        });
        data = { formSubmissions: approvedForms, leaveRequests: approvedLeaves, excuseRequests: approvedExcuses };
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

// @desc    Get custom report with dynamic fields
// @route   POST /api/reports/custom
// @access  Private/Admin
const getCustomReport = async (req, res) => {
  try {
    const { modelName, fields, filters, startDate, endDate } = req.body;

    const Model = mongoose.model(modelName);
    if (!Model) return res.status(400).json({ message: 'Invalid model name' });

    const query = { ...filters };

    // Handle date range
    if (startDate || endDate) {
      const dateField = modelName === 'ExcuseRequest' ? 'submittedDate' : 'submittedAt';
      query[dateField] = {};
      if (startDate) query[dateField].$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query[dateField].$lte = end;
      }
    }

    const data = await Model.find(query).select(fields.join(' ')).lean();
    res.json(data);
  } catch (error) {
    console.error('Error generating custom report:', error);
    res.status(500).json({ message: 'Error generating custom report', error: error.message });
  }
};

// @desc    Create a scheduled report
// @route   POST /api/reports/scheduled
// @access  Private/Admin
const createScheduledReport = async (req, res) => {
  try {
    const { name, reportType, configuration, frequency, recipients, format } = req.body;

    // Calculate first nextRun
    const nextRun = new Date();
    if (frequency === 'daily') nextRun.setDate(nextRun.getDate() + 1);
    else if (frequency === 'weekly') nextRun.setDate(nextRun.getDate() + 7);
    else if (frequency === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1);

    const report = await ScheduledReport.create({
      name,
      reportType,
      configuration,
      frequency,
      recipients,
      format,
      nextRun,
      createdBy: req.user._id
    });

    res.status(201).json(report);
  } catch (error) {
    console.error('Error creating scheduled report:', error);
    res.status(500).json({ message: 'Error creating scheduled report', error: error.message });
  }
};

// @desc    Get all scheduled reports
// @route   GET /api/reports/scheduled
// @access  Private/Admin
const getScheduledReports = async (req, res) => {
  try {
    const reports = await ScheduledReport.find().populate('createdBy', 'name email');
    res.json(reports);
  } catch (error) {
    console.error('Error fetching scheduled reports:', error);
    res.status(500).json({ message: 'Error fetching scheduled reports', error: error.message });
  }
};

// @desc    Delete a scheduled report
// @route   DELETE /api/reports/scheduled/:id
// @access  Private/Admin
const deleteScheduledReport = async (req, res) => {
  try {
    await ScheduledReport.findByIdAndDelete(req.params.id);
    res.json({ message: 'Scheduled report deleted' });
  } catch (error) {
    console.error('Error deleting scheduled report:', error);
    res.status(500).json({ message: 'Error deleting scheduled report', error: error.message });
  }
};

export {
  generateReport,
  getCustomReport,
  createScheduledReport,
  getScheduledReports,
  deleteScheduledReport
};
