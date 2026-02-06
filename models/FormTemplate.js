import mongoose from 'mongoose';

const formTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    description: String,
    category: {
        type: String,
        enum: ['Request', 'Academic', 'Feedback', 'General'],
        default: 'General'
    },
    fields: [
        {
            name: String,
            label: String,
            type: {
                type: String,
                enum: ['text', 'textarea', 'select', 'file', 'date'],
            },
            options: [String],
            validation: {
                required: {
                    type: Boolean,
                    default: false,
                },
            },
        },
    ],
    usageCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
});

const FormTemplate = mongoose.model('FormTemplate', formTemplateSchema);

export default FormTemplate;
