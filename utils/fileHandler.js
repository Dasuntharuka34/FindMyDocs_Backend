import { uploadToBlob } from '../config/vercelBlob.js';
import { del } from '@vercel/blob';
import sharp from 'sharp';

// File type specific size limits
export const FILE_SIZE_LIMITS = {
  'image/jpeg': 5 * 1024 * 1024,  // 5MB for JPEG
  'image/jpg': 5 * 1024 * 1024,   // 5MB for JPG
  'image/png': 5 * 1024 * 1024,   // 5MB for PNG
  'application/pdf': 5 * 1024 * 1024,  // 5MB for PDF
  'application/msword': 5 * 1024 * 1024,  // 5MB for DOC
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 5 * 1024 * 1024  // 5MB for DOCX
};

// Compression thresholds for images (80% of limit)
export const COMPRESSION_THRESHOLD = {
  'image/jpeg': FILE_SIZE_LIMITS['image/jpeg'] * 0.8,
  'image/jpg': FILE_SIZE_LIMITS['image/jpg'] * 0.8,
  'image/png': FILE_SIZE_LIMITS['image/png'] * 0.8
};

// Compression quality levels
export const COMPRESSION_QUALITY = {
  HIGH: 80,
  MEDIUM: 60,
  LOW: 40
};

/**
 * Handles file upload to Vercel Blob with error handling, validation, and compression
 * @param {Buffer} buffer - File buffer
 * @param {string} originalname - Original file name
 * @param {string} mimetype - File MIME type
 * @param {string} category - Category for file organization (e.g., 'excuse-requests', 'leave-requests')
 * @returns {Promise<{success: boolean, url?: string, error?: string, compressionDetails?: object}>}
 */
export const handleFileUpload = async (buffer, originalname, mimetype, category = 'uploads') => {
  try {
    // Validate file type
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const fileExt = originalname.split('.').pop().toLowerCase();
    
    if (!allowedTypes.test(fileExt)) {
      return {
        success: false,
        error: 'Invalid file type. Only JPG, PNG, PDF, DOC, and DOCX files are allowed.'
      };
    }

    let finalBuffer = buffer;
    let compressionDetails = null;

    // Compress image if needed
    if (mimetype.startsWith('image/')) {
      const compressionResult = await compressImageIfNeeded(buffer, mimetype, buffer.length);
      finalBuffer = compressionResult.buffer;
      
      if (compressionResult.compressed) {
        compressionDetails = {
          originalSize: formatFileSize(compressionResult.originalSize),
          compressedSize: formatFileSize(compressionResult.compressedSize),
          compressionRatio: Math.round((1 - compressionResult.compressedSize / compressionResult.originalSize) * 100) + '%'
        };
      }
    }

    // Generate unique filename with size info
    const timestamp = Date.now();
    const sizeInfo = compressionDetails ? `-compressed${compressionDetails.compressionRatio}` : '';
    const uniqueFilename = `${category}/${timestamp}${sizeInfo}-${originalname}`;

    // Upload to Vercel Blob
    const url = await uploadToBlob(finalBuffer, uniqueFilename, {
      contentType: mimetype,
      access: 'public'
    });

    console.log('File uploaded successfully:', {
      filename: uniqueFilename,
      url: url,
      originalSize: formatFileSize(buffer.length),
      finalSize: formatFileSize(finalBuffer.length),
      compressionDetails
    });

    return {
      success: true,
      url: url,
      compressionDetails
    };
  } catch (error) {
    console.error('File upload error:', error);
    return {
      success: false,
      error: error.message || 'Error uploading file'
    };
  }
};

/**
 * Deletes a file from Vercel Blob
 * @param {string} url - The URL of the file to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteFile = async (url) => {
  try {
    if (!url) {
      return { success: true }; // No file to delete
    }

    await del(url);
    console.log('File deleted successfully:', url);
    
    return { success: true };
  } catch (error) {
    console.error('File deletion error:', error);
    return {
      success: false,
      error: error.message || 'Error deleting file'
    };
  }
};

/**
 * Format file size to human readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Compress image if needed
 * @param {Buffer} buffer - Image buffer
 * @param {string} mimetype - Image MIME type
 * @param {number} size - Original file size
 * @returns {Promise<{buffer: Buffer, compressed: boolean}>}
 */
export const compressImageIfNeeded = async (buffer, mimetype, size) => {
  if (!mimetype.startsWith('image/')) {
    return { buffer, compressed: false };
  }

  const threshold = COMPRESSION_THRESHOLD[mimetype];
  if (!threshold || size <= threshold) {
    return { buffer, compressed: false };
  }

  try {
    let quality = COMPRESSION_QUALITY.HIGH;
    if (size > FILE_SIZE_LIMITS[mimetype]) {
      quality = COMPRESSION_QUALITY.MEDIUM;
    }

    const image = sharp(buffer);
    const metadata = await image.metadata();

    // Compress based on image type
    let compressedBuffer;
    if (mimetype === 'image/png') {
      compressedBuffer = await image
        .png({ quality })
        .toBuffer();
    } else {
      compressedBuffer = await image
        .jpeg({ quality })
        .toBuffer();
    }

    console.log('Image compressed:', {
      originalSize: formatFileSize(size),
      compressedSize: formatFileSize(compressedBuffer.length),
      quality: quality
    });

    return { 
      buffer: compressedBuffer, 
      compressed: true,
      originalSize: size,
      compressedSize: compressedBuffer.length
    };
  } catch (error) {
    console.error('Compression error:', error);
    return { buffer, compressed: false };
  }
};

/**
 * Validates file metadata
 * @param {Object} file - File object from multer
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export const validateFile = async (file) => {
  try {
    if (!file) {
      return { valid: false, error: 'No file provided' };
    }

    // Check file size based on type
    const sizeLimit = FILE_SIZE_LIMITS[file.mimetype];
    if (!sizeLimit) {
      return { 
        valid: false, 
        error: 'Unsupported file type' 
      };
    }

    if (file.size > sizeLimit) {
      return { 
        valid: false, 
        error: `File size too large. Your file: ${formatFileSize(file.size)}. Maximum size for ${file.mimetype}: ${formatFileSize(sizeLimit)}` 
      };
    }

    // Validate MIME type
    const allowedMimes = Object.keys(FILE_SIZE_LIMITS);
    if (!allowedMimes.includes(file.mimetype)) {
      return { 
        valid: false, 
        error: 'Invalid file type. Only JPG, PNG, PDF, DOC, and DOCX files are allowed' 
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('File validation error:', error);
    return {
      valid: false,
      error: error.message || 'Error validating file'
    };
  }
};
