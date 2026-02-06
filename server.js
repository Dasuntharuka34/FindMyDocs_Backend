import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import connectDB from './config/db.js';

// Import Routes
import excuseRequestRoutes from './routes/excuseRequestRoutes.js';
import leaveRequestRoutes from './routes/leaveRequestRoutes.js';
import letterRoutes from './routes/letterRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import registrationRoutes from './routes/registrationRoutes.js';
import userRoutes from './routes/userRoutes.js';

import formRoutes from './routes/formRoutes.js';
import formSubmissionRoutes from './routes/formSubmissionRoutes.js';
import seedRoutes from './routes/seedRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js'; // Import the new upload routes
import analyticsRoutes from './routes/analyticsRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import securityRoutes from './routes/securityRoutes.js';
import developerRoutes from './routes/developerRoutes.js';
import templateRoutes from './routes/templateRoutes.js';
import systemConfigRoutes from './routes/systemConfigRoutes.js';
import emailManagementRoutes from './routes/emailManagementRoutes.js';
import userEnhancementRoutes from './routes/userEnhancementRoutes.js';
import requestTemplateRoutes from './routes/requestTemplateRoutes.js';
import autoApprovalRoutes from './routes/autoApprovalRoutes.js';
import databaseRoutes from './routes/databaseRoutes.js';
import cleanupRoutes from './routes/cleanupRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import roleRoutes from './routes/roleRoutes.js';
import workflowRoutes from './routes/workflowRoutes.js';
import checkMaintenanceMode from './middleware/maintenanceMiddleware.js';
import { initScheduledReports } from './utils/reportScheduler.js';
import errorHandler from './middleware/errorMiddleware.js';
import performanceMiddleware from './middleware/performanceMiddleware.js';

initScheduledReports();

const app = express();
app.use(performanceMiddleware);

const ensureDbConnection = async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database connection error in middleware:", error);
    res.status(500).json({ message: "Failed to connect to the database." });
  }
};

app.use(ensureDbConnection);

// --- Middleware ---
app.use(
  cors({
    origin: ['https://find-my-docs-frontend.vercel.app', 'http://localhost:3000'], // Explicitly set the frontend origin
    credentials: true,
  })
);
app.use(express.json()); // Parse JSON bodies

// --- Maintenance Middleware ---
app.use(checkMaintenanceMode);

// --- Routes ---
app.use('/api/users', userRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/letters', letterRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/excuserequests', excuseRequestRoutes);
app.use('/api/leaverequests', leaveRequestRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api/form-submissions', formSubmissionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/upload', uploadRoutes); // Register the new upload routes
app.use('/api/analytics', analyticsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/system-config', systemConfigRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/developer', developerRoutes);
app.use('/api/form-templates', templateRoutes);
app.use('/api/email-management', emailManagementRoutes);
app.use('/api/user-enhancement', userEnhancementRoutes);
app.use('/api/request-templates', requestTemplateRoutes);
app.use('/api/auto-approval-rules', autoApprovalRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/cleanup', cleanupRoutes);
app.use('/api/departments', departmentRoutes);

// --- Root Route ---
app.get('/', (req, res) => {
  res.send('FindMyDocs Backend API is running...');
});

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});


// --- Error Handler ---
app.use(errorHandler);

// Export the Express app
export default app;
