import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendNotificationEmail } from './utils/mailService.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

const testEmail = async () => {
  const recipientEmail = process.env.SENDER_EMAIL_ADDRESS; // Sending to self for testing
  const notificationContent = "This is a test notification email from the FindMyDocs backend.";

  if (!recipientEmail) {
    console.error("SENDER_EMAIL_ADDRESS not found in .env. Please set it to a valid email for testing.");
    return;
  }

  console.log(`Attempting to send test notification email to: ${recipientEmail}`);
  try {
    await sendNotificationEmail(recipientEmail, notificationContent);
    console.log('Test notification email sent successfully!');
  } catch (error) {
    console.error('Failed to send test notification email:', error);
  }
};

testEmail();