import express from 'express';
import {
    getWorkflows,
    getWorkflowByType,
    saveWorkflow,
    initializeWorkflows
} from '../controllers/workflowController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, admin, getWorkflows);
router.get('/:requestType', getWorkflowByType);
router.post('/', protect, admin, saveWorkflow);
router.post('/initialize', protect, admin, initializeWorkflows);

export default router;
