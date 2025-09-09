import express from 'express';
import {
    createNotification,
    deleteAllNotificationsByUser,
    deleteNotification,
    getNotificationsByUser,
    markNotificationAsRead
} from '../controllers/notificationController.js';
const router = express.Router();

router.route('/byUser/:userId')
  .get(getNotificationsByUser)
  .delete(deleteAllNotificationsByUser); // Add DELETE endpoint for all user notifications

router.route('/').post(createNotification);

router.route('/:id')
  .delete(deleteNotification); // Add DELETE endpoint for single notification

router.route('/:id/read').put(markNotificationAsRead);

export default router;
