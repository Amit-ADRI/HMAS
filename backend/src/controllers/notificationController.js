const Notification = require('../models/Notification');

// GET /api/v1/notifications
const getMyNotifications = async (req, res) => {
  const { isRead, type, page = 1, limit = 20 } = req.query;

  const filter = { recipient: req.user._id };
  if (isRead !== undefined) filter.isRead = isRead === 'true';
  if (type) filter.type = type;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: req.user._id, isRead: false }),
  ]);

  return res.status(200).json({
    success: true,
    total,
    unreadCount,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    notifications,
  });
};

// PATCH /api/v1/notifications/:id/read
const markAsRead = async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    recipient: req.user._id,
  });

  if (!notification) {
    return res.status(404).json({ success: false, message: 'Notification not found.' });
  }

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  return res.status(200).json({ success: true, message: 'Marked as read.', notification });
};

// PATCH /api/v1/notifications/mark-all-read
const markAllAsRead = async (req, res) => {
  const result = await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );

  return res.status(200).json({
    success: true,
    message: `${result.modifiedCount} notification(s) marked as read.`,
    modifiedCount: result.modifiedCount,
  });
};

// GET /api/v1/notifications/unread-count
const getUnreadCount = async (req, res) => {
  const count = await Notification.countDocuments({
    recipient: req.user._id,
    isRead: false,
  });

  return res.status(200).json({ success: true, unreadCount: count });
};

module.exports = { getMyNotifications, markAsRead, markAllAsRead, getUnreadCount };
