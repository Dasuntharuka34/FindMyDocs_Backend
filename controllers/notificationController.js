import Notification from '../models/Notification.js';

// @desc    Get all notifications for a specific user
// @route   GET /api/notifications/byUser/:userId
// @access  Private (User specific)
const getNotificationsByUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
};

// @desc    Create a new notification
// @route   POST /api/notifications
// @access  Private (Internal/Admin)
const createNotification = async (req, res) => {
  const { userId, message, type } = req.body;
  try {
    const notification = await Notification.create({
      userId,
      message,
      type,
    });
    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Error creating notification', error: error.message });
  }
};

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private (User specific)
const markNotificationAsRead = async (req, res) => {
  const { id } = req.params;
  try {
    const notification = await Notification.findById(id);

    if (notification) {
      notification.read = true;
      const updatedNotification = await notification.save();
      res.json(updatedNotification);
    } else {
      res.status(404).json({ message: 'Notification not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error marking notification as read', error: error.message });
  }
};

// @desc    Delete a single notification
// @route   DELETE /api/notifications/:id
// @access  Private (User specific)
const deleteNotification = async (req, res) => {
  const { id } = req.params;
  try {
    const notification = await Notification.findByIdAndDelete(id);
    if (notification) {
      res.json({ message: 'Notification deleted successfully' });
    } else {
      res.status(404).json({ message: 'Notification not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error deleting notification', error: error.message });
  }
};

// @desc    Delete all notifications for a user
// @route   DELETE /api/notifications/byUser/:userId
// @access  Private (User specific)
const deleteAllNotificationsByUser = async (req, res) => {
  const { userId } = req.params;
  try {
    await Notification.deleteMany({ userId });
    res.json({ message: 'All notifications deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting notifications', error: error.message });
  }
};

export { getNotificationsByUser, createNotification, markNotificationAsRead, deleteNotification, deleteAllNotificationsByUser };
