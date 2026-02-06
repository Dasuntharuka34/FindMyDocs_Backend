import mongoose from 'mongoose';

/**
 * Creates a JSON backup of all registered Mongoose models.
 * @returns {Promise<Object>} Object containing data for each collection.
 */
export const createBackup = async () => {
    const models = mongoose.modelNames();
    const backupData = {};

    for (const modelName of models) {
        const Model = mongoose.model(modelName);
        const documents = await Model.find({}).lean(); // lean() for plain JS objects
        backupData[modelName] = documents;
    }

    return {
        timestamp: new Date().toISOString(),
        data: backupData
    };
};

/**
 * Restores the database from a JSON backup.
 * WARNING: This will clear existing data in the collections present in the backup.
 * @param {Object} backupObject - The parsed JSON backup object.
 * @returns {Promise<Object>} Report of restored collections and counts.
 */
export const restoreBackup = async (backupObject) => {
    if (!backupObject || !backupObject.data) {
        throw new Error('Invalid backup file format');
    }

    const report = {};
    const data = backupObject.data;
    const models = Object.keys(data);

    // Use a transaction if replica set is available, otherwise sequential
    // Since we don't know if RS is enabled, we'll try to use a session, fallback to standard
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        for (const modelName of models) {
            // Check if model exists in current application
            if (mongoose.modelNames().includes(modelName)) {
                const Model = mongoose.model(modelName);
                const documents = data[modelName];

                // Clear existing data
                await Model.deleteMany({}, { session });

                // Insert new data
                if (documents.length > 0) {
                    await Model.insertMany(documents, { session });
                }

                report[modelName] = documents.length;
            } else {
                console.warn(`Model ${modelName} in backup not found in application. Skipping.`);
                report[modelName] = 'Skipped (Model not found)';
            }
        }

        await session.commitTransaction();
        session.endSession();
        return report;

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        // If transaction fail (e.g. standalone Mongo), try non-transactional fallback?
        // For now, re-throw to alert user.
        throw error;
    }
};
