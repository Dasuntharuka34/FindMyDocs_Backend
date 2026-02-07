import express from 'express';
const router = express.Router();
import {
  getForms,
  getFormById,
  createForm,
  updateForm,
  deleteForm,
  updateFormStatus,
  getAvailableForms,
  getFormAnalytics,
  createNewVersion,
  updateFormRoles,
  getAvailableRoles
} from '../controllers/formController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

router.route('/').get(protect, admin, getForms).post(protect, admin, createForm);
router.get('/available', protect, getAvailableForms);
router.get('/analytics', protect, admin, getFormAnalytics);
router.get('/roles/available', protect, admin, getAvailableRoles);

router
  .route('/:id')
  .get(protect, getFormById)
  .put(protect, admin, updateForm)
  .delete(protect, admin, deleteForm);
router.route('/:id/status').put(protect, admin, updateFormStatus);
router.route('/:id/roles').put(protect, admin, updateFormRoles);

router.post('/:id/version', protect, admin, createNewVersion);

export default router;