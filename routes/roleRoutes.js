import express from 'express';
import {
    getRoles,
    createRole,
    updateRole,
    deleteRole,
    initializeRoles,
    getPublicRoles
} from '../controllers/roleController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/public', getPublicRoles);
router.get('/', protect, admin, getRoles);
router.post('/', protect, admin, createRole);
router.put('/:id', protect, admin, updateRole);
router.delete('/:id', protect, admin, deleteRole);
router.post('/initialize', protect, admin, initializeRoles);

export default router;
