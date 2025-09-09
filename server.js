// server.js

import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import connectDB from './config/db.js';

// Import Routes
import excuseRequestRoutes from './routes/excuseRequestRoutes.js';
import leaveRequestRoutes from './routes/leaveRequestRoutes.js';
import letterRoutes from './routes/letterRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import registrationRoutes from './routes/registrationRoutes.js';
import userRoutes from './routes/userRoutes.js';

dotenv.config();

// Connect to database
connectDB();

const app = express();

// --- Middleware ---
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);
app.use(express.json()); // Parse JSON bodies

// --- Handle static file uploads ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsBaseDir = path.join(__dirname, 'uploads');
// Note: In Vercel serverless, filesystem is read-only for writes, so mkdirSync is removed to prevent crashes
// File uploads should use cloud storage instead

// Serve uploads folder publicly (only if directory exists)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.use('/uploads', express.static(uploadsBaseDir));
}

// --- API Routes ---
app.use('/api/users', userRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/letters', letterRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/excuserequests', excuseRequestRoutes);
app.use('/api/leaverequests', leaveRequestRoutes);

// --- Root Route ---
app.get('/', (req, res) => {
  res.send('API is running...');
});

// --- Error Handler ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something broke!', error: err.message });
});

// --- Server Start ---
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0'; // Bind to all interfaces

app.listen(PORT, HOST, () =>
  console.log(
    `Server running in ${process.env.NODE_ENV || 'development'} mode on ${HOST}:${PORT}`
  )
);
