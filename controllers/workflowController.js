import Workflow from '../models/Workflow.js';

// @desc    Get all workflows
// @route   GET /api/workflows
// @access  Private/Admin
export const getWorkflows = async (req, res) => {
    try {
        const workflows = await Workflow.find({});
        res.json(workflows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching workflows', error: error.message });
    }
};

// @desc    Get workflow by request type
// @route   GET /api/workflows/:requestType
// @access  Public
export const getWorkflowByType = async (req, res) => {
    try {
        const workflow = await Workflow.findOne({ requestType: req.params.requestType, isActive: true });
        if (!workflow) {
            return res.status(404).json({ message: 'Workflow not found' });
        }
        res.json(workflow);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching workflow', error: error.message });
    }
};

// @desc    Update or Create workflow
// @route   POST /api/workflows
// @access  Private/Admin
export const saveWorkflow = async (req, res) => {
    try {
        const { requestType, steps, description, isActive } = req.body;

        const workflow = await Workflow.findOneAndUpdate(
            { requestType },
            { steps, description, isActive },
            { upsert: true, new: true }
        );

        res.json(workflow);
    } catch (error) {
        res.status(500).json({ message: 'Error saving workflow', error: error.message });
    }
};

// @desc    Initialize default workflows
// @route   POST /api/workflows/initialize
// @access  Private/Admin
export const initializeWorkflows = async (req, res) => {
    try {
        const defaultWorkflows = [
            {
                requestType: 'Excuse',
                description: 'Default Excuse Request Workflow',
                steps: [
                    { name: 'Pending Lecturer Approval', approverRole: 'Lecturer' },
                    { name: 'Pending HOD Approval', approverRole: 'HOD' },
                    { name: 'Pending Dean Approval', approverRole: 'Dean' }
                ]
            },
            {
                requestType: 'Leave',
                description: 'Default Leave Request Workflow',
                steps: [
                    { name: 'Pending HOD Approval', approverRole: 'HOD' },
                    { name: 'Pending Dean Approval', approverRole: 'Dean' }
                ]
            },
            {
                requestType: 'Letter',
                description: 'Default Letter Request Workflow',
                steps: [
                    { name: 'Pending Lecturer Approval', approverRole: 'Lecturer' },
                    { name: 'Pending HOD Approval', approverRole: 'HOD' },
                    { name: 'Pending Dean Approval', approverRole: 'Dean' },
                    { name: 'Pending VC Approval', approverRole: 'VC' }
                ]
            }
        ];

        for (const wf of defaultWorkflows) {
            await Workflow.findOneAndUpdate(
                { requestType: wf.requestType },
                wf,
                { upsert: true }
            );
        }

        res.json({ message: 'Workflows initialized successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error initializing workflows', error: error.message });
    }
};
