import nodemailer from 'nodemailer';
import { google } from 'googleapis';

const OAuth2 = google.auth.OAuth2;

const createTransporter = async () => {
  const oauth2Client = new OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.REFRESH_TOKEN,
  });

  const { token: accessToken } = await oauth2Client.getAccessToken();

  // Check if a new refresh token was issued
  if (oauth2Client.credentials.refresh_token && oauth2Client.credentials.refresh_token !== process.env.REFRESH_TOKEN) {
    console.warn('A new REFRESH_TOKEN was issued. Please update your .env file with the new token:');
    console.warn('NEW_REFRESH_TOKEN:', oauth2Client.credentials.refresh_token);
    // Optionally, you could attempt to write this to the .env file, but it's generally not recommended
    // for a running application to modify its own environment variables.
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.SENDER_EMAIL_ADDRESS,
      accessToken,
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      refreshToken: oauth2Client.credentials.refresh_token || process.env.REFRESH_TOKEN, // Use the potentially new refresh token
    },
  });

  return transporter;
};

export const sendEmail = async (emailOptions) => {
  try {
    let emailTransporter = await createTransporter();
    await emailTransporter.sendMail(emailOptions);
    console.log('Email sent successfully to:', emailOptions.to);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error; // Re-throw the error for further handling if needed
  }
};

export const sendRegistrationEmail = async (toEmail, userName) => {
  const mailOptions = {
    from: process.env.SENDER_EMAIL_ADDRESS,
    to: toEmail,
    subject: 'Registration form submitted Successfully',
    html: `
      <p>Dear ${userName},</p>
      <p>Your registration request has been submitted successfully.</p>
      <p>Your account is now pending admin approval. You will be notified via email once your account is approved.</p>
      <p>Thank you for joining FindMyDocs!</p>
      <p>Best regards,</p>
      <p>The FindMyDocs Team</p>
    `,
  };
  await sendEmail(mailOptions);
};

export const sendNotificationEmail = async (toEmail, notificationContent) => {
  const mailOptions = {
    from: process.env.SENDER_EMAIL_ADDRESS,
    to: toEmail,
    subject: 'New Notification in FindMyDocs',
    html: `
      <p>Dear User,</p>
      <p>You have a new unread notification in FindMyDocs:</p>
      <p>${notificationContent}</p>
      <p>Please log in to your account to view the details.</p>
      <p>Best regards,</p>
      <p>The FindMyDocs Team</p>
    `,
  };
  await sendEmail(mailOptions);
};
