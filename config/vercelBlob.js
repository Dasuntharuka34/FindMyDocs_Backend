import { put, list, del } from '@vercel/blob';

export const uploadToBlob = async (buffer, filename, options = {}) => {
  // ... existing
};

export const listBlobs = async (options = {}) => {
  try {
    const { blobs } = await list(options);
    return blobs;
  } catch (error) {
    console.error('Error listing blobs:', error);
    throw error;
  }
};

export const deleteBlob = async (url) => {
  try {
    await del(url);
  } catch (error) {
    console.error('Error deleting blob:', error);
    throw error;
  }
};

