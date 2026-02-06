import nodemailer from 'nodemailer';


const createTransporter = async () => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return transporter;
};

export const sendEmail = async (emailOptions) => {
  try {
    // Check if email notifications are enabled in system config
    const SystemConfig = (await import('../models/SystemConfig.js')).default;
    const emailNotificationsConfig = await SystemConfig.findOne({ key: 'EMAIL_NOTIFICATIONS_ENABLED' });

    if (emailNotificationsConfig && emailNotificationsConfig.value === false) {
      console.log('Email notifications are disabled. Skipping email to:', emailOptions.to);
      return; // Gracefully skip sending email
    }

    let emailTransporter = await createTransporter();
    await emailTransporter.sendMail(emailOptions);
    console.log('Email sent successfully to:', emailOptions.to);
  } catch (error) {
    console.error('Error sending email:', error);
    // Don't throw error - just log it to prevent request failures
    // throw error; // Re-throw the error for further handling if needed
  }
};

export const sendRegistrationEmail = async (toEmail, userName) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
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
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
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
