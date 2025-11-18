
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Form from './models/Form.js';
import connectDB from './config/db.js';

dotenv.config();

const seedForms = async () => {
  try {
    await connectDB();

    const forms = [
      {
        name: 'Leave Request',
        description: 'Form for staff to request leave.',
        fields: [
          { name: 'startDate', label: 'Start Date', type: 'date', validation: { required: true } },
          { name: 'endDate', label: 'End Date', type: 'date', validation: { required: true } },
          { name: 'reason', label: 'Reason for Leave', type: 'select', options: ['Official', 'Personal', 'Illness'], validation: { required: true } },
          { name: 'reasonDetails', label: 'Details of Reason', type: 'textarea', validation: { required: true } },
          { name: 'contactDuringLeave', label: 'Contact During Leave', type: 'text' },
          { name: 'remarks', label: 'Remarks', type: 'textarea' },
          { name: 'attachment', label: 'Supporting Document', type: 'file' },
        ],
        createdBy: new mongoose.Types.ObjectId("68a0750bebe54e1bb6247913"), 
      },
      {
        name: 'Excuse Request',
        description: 'Form for students to request excuse for absence.',
        fields: [
          { name: 'name', label: 'Name with Initials', type: 'text', validation: { required: true } },
          { name: 'regNo', label: 'Registration Number', type: 'text', validation: { required: true } },
          { name: 'mobile', label: 'Mobile Number', type: 'text' },
          { name: 'email', label: 'Email Address', type: 'text' },
          { name: 'address', label: 'Postal Address', type: 'textarea' },
          { name: 'levelOfStudy', label: 'Level of Study', type: 'select', options: ['1G', '1S', '2G', '2S', '3G', '3S', '3M', '4S', '4M', '4X'] },
          { name: 'subjectCombo', label: 'Subject Combination', type: 'text' },
          { name: 'absences', label: 'Period of Absence (Course Code and Date)', type: 'textarea', validation: { required: true } },
          { name: 'reason', label: 'Reason for Absence', type: 'select', options: ["Official university assignment", "Applicant's wedding", "Sudden illness or hospitalization", "Demise of a parent/guardian/sibling"], validation: { required: true } },
          { name: 'reasonDetails', label: 'Details of Reason', type: 'textarea' },
          { name: 'lectureAbsents', label: 'Lectures/Practicals Missed', type: 'text' },
          { name: 'medicalCertificate', label: 'Medical Certificate', type: 'file' },
        ],
        createdBy: new mongoose.Types.ObjectId("68a0750bebe54e1bb6247913"), 
      },
    ];

    await Form.deleteMany({});
    await Form.insertMany(forms);

    console.log('Forms seeded successfully!');
    process.exit();
  } catch (error) {
    console.error(`Error seeding forms: ${error}`);
    process.exit(1);
  }
};

seedForms();
