import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SpecialForm from './models/SpecialForm.js';
import connectDB from './config/db.js';

dotenv.config();

const seedSpecialForms = async () => {
  try {
    await connectDB();

    const specialForms = [
      { name: 'Leave Request' },
      { name: 'Excuse Request' },
    ];

    for (const form of specialForms) {
      const existingForm = await SpecialForm.findOne({ name: form.name });
      if (!existingForm) {
        await SpecialForm.create(form);
      }
    }

    console.log('Special forms seeded successfully!');
    process.exit();
  } catch (error) {
    console.error(`Error seeding special forms: ${error}`);
    process.exit(1);
  }
};

seedSpecialForms();
