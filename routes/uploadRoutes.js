import express from 'express';
import { uploadToBlob } from '../config/vercelBlob.js';
import { protect } from '../middleware/authMiddleware.js'; // Assuming you want to protect this route

const router = express.Router();

// Middleware to parse raw body for file uploads
router.post('/', protect, express.raw({ type: 'application/octet-stream', limit: '10mb' }), async (req, res) => {
  try {
    const { filename } = req.query;

    if (!filename) {
      return res.status(400).json({ message: 'Filename is required as a query parameter.' });
    }

    if (!req.body) {
      return res.status(400).json({ message: 'Request body (file content) is missing.' });
    }

    // req.body is already a Buffer due to express.raw()
    const buffer = req.body;

    const blobUrl = await uploadToBlob(buffer, filename);

    res.status(200).json({ url: blobUrl });
  } catch (error) {
    console.error('Error handling file upload:', error);
    res.status(500).json({ message: 'Failed to upload file.', error: error.message });
  }
});

export default router;
