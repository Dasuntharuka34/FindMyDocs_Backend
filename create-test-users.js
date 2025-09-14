import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';

dotenv.config();

const createTestUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Create regular user
    const regularUser = {
      name: 'Dasun Madushan',
      email: 'Dasun@gmail.com',
      nic: '200012345678',
      password: '123456',
      role: 'User',
      department: 'Computer Science',
      mobile: '0771234567',
      profilePicture: null,
    };

    // Create admin user
    const adminUser = {
      name: 'System Administrator',
      email: 'Admin@gmail.com',
      nic: '199012345678',
      password: '123',
      role: 'Admin',
      department: 'IT',
      mobile: '0712345678',
      profilePicture: null,
    };

    // Hash passwords
    const salt = await bcrypt.genSalt(10);
    regularUser.password = await bcrypt.hash(regularUser.password, salt);
    adminUser.password = await bcrypt.hash(adminUser.password, salt);

    // Check and create regular user
    const existingRegularUser = await User.findOne({ email: regularUser.email });
    if (!existingRegularUser) {
      await User.create(regularUser);
      console.log('✅ Regular user created successfully!');
      console.log('📧 Email: Dasun@gmail.com');
      console.log('🔑 Password: 123456');
      console.log('👤 Role: User');
    } else {
      console.log('Regular user already exists');
    }

    // Check and create admin user
    const existingAdminUser = await User.findOne({ email: adminUser.email });
    if (!existingAdminUser) {
      await User.create(adminUser);
      console.log('✅ Admin user created successfully!');
      console.log('📧 Email: Admin@gmail.com');
      console.log('🔑 Password: 123');
      console.log('👤 Role: Admin');
    } else {
      console.log('Admin user already exists');
    }

  } catch (error) {
    console.error('❌ Error creating test users:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the script
createTestUsers();
