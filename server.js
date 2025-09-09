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
try {
  if (!fs.existsSync(uploadsBaseDir)) {
    fs.mkdirSync(uploadsBaseDir, { recursive: true });
    console.log(`Created base uploads directory at: ${uploadsBaseDir}`);
  }
} catch (err) {
  console.error(`Failed to create uploads directory: ${err.message}`);
}

// Ensure profile_pictures directory exists
const profilePicturesDir = path.join(uploadsBaseDir, 'profile_pictures');
try {
  if (!fs.existsSync(profilePicturesDir)) {
    fs.mkdirSync(profilePicturesDir, { recursive: true });
    console.log(`Created profile_pictures directory at: ${profilePicturesDir}`);
  }
} catch (err) {
  console.error(`Failed to create profile_pictures directory: ${err.message}`);
}

// Ensure documents directory exists
const documentsDir = path.join(uploadsBaseDir, 'documents');
try {
  if (!fs.existsSync(documentsDir)) {
    fs.mkdirSync(documentsDir, { recursive: true });
    console.log(`Created documents directory at: ${documentsDir}`);
  }
} catch (err) {
  console.error(`Failed to create documents directory: ${err.message}`);
}

// Serve uploads folder publicly
app.use('/uploads', express.static(uploadsBaseDir));

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
