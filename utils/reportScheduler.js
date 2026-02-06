import cron from 'node-cron';
import ScheduledReport from '../models/ScheduledReport.js';
import { sendEmail } from './mailService.js';
import mongoose from 'mongoose';

/**
 * Initialize cron jobs for scheduled reports
 */
export const initScheduledReports = () => {
    // Run every hour at minute 0
    cron.schedule('0 * * * *', async () => {
        console.log('Running scheduled reports check...');
        const now = new Date();

        try {
            const pendingReports = await ScheduledReport.find({
                isActive: true,
                nextRun: { $lte: now }
            });

            for (const report of pendingReports) {
                await processScheduledReport(report);
            }
        } catch (error) {
            console.error('Error in scheduled reports cron:', error);
        }
    });
};

const processScheduledReport = async (report) => {
    try {
        console.log(`Processing scheduled report: ${report.name}`);

        let data = [];
        const { reportType, configuration } = report;

        // Fetch data based on report type
        if (reportType === 'custom') {
            const Model = mongoose.model(configuration.model);
            data = await Model.find(configuration.filters || {}).select(configuration.fields.join(' ')).lean();
        } else {
            // Simplified logic for standard reports
            const ModelMap = {
                'excuseRequests': 'ExcuseRequest',
                'leaveRequests': 'LeaveRequest',
                'formSubmissions': 'FormSubmission',
                'users': 'User'
            };
            const modelName = ModelMap[reportType];
            if (modelName) {
                const Model = mongoose.model(modelName);
                data = await Model.find({}).limit(1000).lean();
            }
        }

        // Convert to CSV
        const csv = convertToCSV(data, configuration.fields || []);

        // Send Email
        await sendEmail({
            to: report.recipients.join(','),
            subject: `Scheduled Report: ${report.name}`,
            html: `
                <h3>Your scheduled report is ready</h3>
                <p><strong>Report:</strong> ${report.name}</p>
                <p><strong>Generated at:</strong> ${new Date().toLocaleString()}</p>
                <p>Please find the attached CSV report.</p>
            `,
            attachments: [
                {
                    filename: `${report.name.replace(/\s+/g, '_')}.csv`,
                    content: csv
                }
            ]
        });

        // Update lastRun and nextRun
        report.lastRun = new Date();
        const nextRun = new Date();
        if (report.frequency === 'daily') nextRun.setDate(nextRun.getDate() + 1);
        else if (report.frequency === 'weekly') nextRun.setDate(nextRun.getDate() + 7);
        else if (report.frequency === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1);

        report.nextRun = nextRun;
        await report.save();

        console.log(`Successfully sent scheduled report: ${report.name}`);
    } catch (error) {
        console.error(`Error processing scheduled report ${report._id}:`, error);
    }
};

const convertToCSV = (data, fields) => {
    if (!data || data.length === 0) return 'No data found';

    const headers = fields.length > 0 ? fields : Object.keys(data[0]);
    const headerRow = headers.join(',');

    const rows = data.map(item => {
        return headers.map(header => {
            let val = item[header] === undefined ? '' : item[header];
            if (val instanceof Date) val = val.toISOString();
            if (typeof val === 'string' && val.includes(',')) val = `"${val}"`;
            return val;
        }).join(',');
    });

    return [headerRow, ...rows].join('\r\n');
};
