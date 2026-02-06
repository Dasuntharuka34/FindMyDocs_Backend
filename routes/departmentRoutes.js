import express from 'express';
import {
    getDepartments,
    getAllDepartmentsAdmin,
    createDepartment,
    updateDepartment,
    deleteDepartment
} from '../controllers/departmentController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', getDepartments);
router.get('/admin', protect, admin, getAllDepartmentsAdmin);
router.post('/', protect, admin, createDepartment);
router.put('/:id', protect, admin, updateDepartment);
router.delete('/:id', protect, admin, deleteDepartment);

export default router;
