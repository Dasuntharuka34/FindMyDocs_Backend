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

const app = express();

// Connect to database
connectDB();

// --- Middleware ---
app.use(
  cors({
    origin: '*',
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

// Export the Express app for Vercel
export default app;
