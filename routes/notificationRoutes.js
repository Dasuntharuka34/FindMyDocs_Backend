import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
    createNotification,
    deleteAllNotificationsByUser,
    deleteNotification,
    getNotificationsByUser,
    markNotificationAsRead
} from '../controllers/notificationController.js';
const router = express.Router();

router.route('/byUser/:userId')
  .get(protect, getNotificationsByUser)
  .delete(protect, deleteAllNotificationsByUser); // Add DELETE endpoint for all user notifications

router.route('/').post(protect, createNotification);

router.route('/:id')
  .delete(protect, deleteNotification); // Add DELETE endpoint for single notification

router.route('/:id/read').put(protect, markNotificationAsRead);

export default router;
