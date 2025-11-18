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

const app = express();

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

// --- API Routes ---
app.use('/api/users', userRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/letters', letterRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/excuserequests', excuseRequestRoutes);
app.use('/api/leaverequests', leaveRequestRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api/form-submissions', formSubmissionRoutes);

// --- Root Route ---
app.get('/', (req, res) => {
  res.send('FindMyDocs Backend API is running...');
});

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});


// --- Error Handler ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something broke!', error: err.message });
});

// Export the Express app
export default app;
