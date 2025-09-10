import { put } from '@vercel/blob';

export const uploadToBlob = async (buffer, filename, options = {}) => {
  try {
    const blob = await put(filename, buffer, {
      access: 'public',
      ...options,
    });
    return blob.url;
  } catch (error) {
    console.error('Error uploading to Vercel Blob:', error);
    throw error;
  }
};
