import express from 'express';
const router = express.Router();
import {
  getForms,
  getFormById,
  createForm,
  updateForm,
  deleteForm,
} from '../controllers/formController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

router.route('/').get(protect, admin, getForms).post(protect, admin, createForm);
router
  .route('/:id')
  .get(protect, getFormById)
  .put(protect, admin, updateForm)
  .delete(protect, admin, deleteForm);

export default router;