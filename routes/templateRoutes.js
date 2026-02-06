import express from 'express';
import {
    getTemplates,
    createTemplate,
    deleteTemplate
} from '../controllers/templateController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, admin, getTemplates)
    .post(protect, admin, createTemplate);

router.route('/:id')
    .delete(protect, admin, deleteTemplate);

export default router;
