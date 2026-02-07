
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import FormSubmission from './models/FormSubmission.js';
import Form from './models/Form.js';

dotenv.config();

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            useUnifiedTopology: true,
            useNewUrlParser: true,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const debugAnalytics = async () => {
    await connectDB();

    try {
        const submissionCount = await FormSubmission.countDocuments();
        console.log(`Total FormSubmissions: ${submissionCount}`);

        const formsCount = await Form.countDocuments();
        console.log(`Total Forms: ${formsCount}`);

        if (submissionCount > 0) {
            const sampleSubmission = await FormSubmission.findOne();
            console.log('Sample Submission:', JSON.stringify(sampleSubmission, null, 2));

            const analytics = await FormSubmission.aggregate([
                {
                    $group: {
                        _id: { formId: '$form', status: '$status' },
                        count: { $sum: 1 }
                    }
                },
                {
                    $lookup: {
                        from: 'forms',
                        localField: '_id.formId',
                        foreignField: '_id',
                        as: 'formInfo'
                    }
                },
                // {
                //   $unwind: '$formInfo' // Commented out to see if lookup fails
                // },
                {
                    $project: {
                        formName: '$formInfo.name', // Will be array if not unwinded
                        status: '$_id.status',
                        count: 1,
                        _id: 0,
                        formId: '$_id.formId'
                    }
                }
            ]);
            console.log('Aggregation Result (without unwind):', JSON.stringify(analytics, null, 2));
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
        process.exit();
    }
};

debugAnalytics();
