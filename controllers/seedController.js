
import mongoose from 'mongoose';
import Form from '../models/Form.js';

const seedForms = async (req, res) => {
  try {
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
        createdBy: req.user._id,
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
        createdBy: req.user._id,
      },
    ];

    await Form.deleteMany({});
    await Form.insertMany(forms);

    res.status(201).json({ message: 'Forms seeded successfully!' });
  } catch (error) {
    res.status(500).json({ message: `Error seeding forms: ${error.message}` });
  }
};

export { seedForms };
