import express from 'express';
import {
    createTemplate,
    getTemplates,
    getTemplateById,
    updateTemplate,
    deleteTemplate,
    toggleTemplateStatus
} from '../controllers/requestTemplateController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .post(protect, admin, createTemplate)
    .get(protect, getTemplates); // Allow users to fetch templates (filtered by active in controller)

router.route('/:id')
    .get(protect, getTemplateById)
    .put(protect, admin, updateTemplate)
    .delete(protect, admin, deleteTemplate);

router.patch('/:id/toggle-status', protect, admin, toggleTemplateStatus);

export default router;
