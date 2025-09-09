import express from 'express';
const router = express.Router();
import {
  getNotificationsByUser,
  createNotification,
  markNotificationAsRead,
  deleteNotification,
  deleteAllNotificationsByUser
} from '../controllers/notificationController.js';

router.route('/byUser/:userId')
  .get(getNotificationsByUser)
  .delete(deleteAllNotificationsByUser); // Add DELETE endpoint for all user notifications

router.route('/').post(createNotification);

router.route('/:id')
  .delete(deleteNotification); // Add DELETE endpoint for single notification

router.route('/:id/read').put(markNotificationAsRead);

export default router;