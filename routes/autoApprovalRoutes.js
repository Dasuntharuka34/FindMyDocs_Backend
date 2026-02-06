import express from 'express';
import {
    createRule,
    getRules,
    updateRule,
    deleteRule,
    toggleRuleStatus
} from '../controllers/autoApprovalController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .post(protect, admin, createRule)
    .get(protect, admin, getRules);

router.route('/:id')
    .put(protect, admin, updateRule)
    .delete(protect, admin, deleteRule);

router.patch('/:id/toggle', protect, admin, toggleRuleStatus);

export default router;
