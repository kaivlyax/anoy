const express = require("express");

const router = express.Router();

const protect =
    require("../middleware/authMiddleware");

const {
    getMyNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification
} = require("../controllers/notificationController");


// Get my notifications
router.get(
    "/",
    protect,
    getMyNotifications
);

// Get unread notification count
router.get(
    "/unread-count",
    protect,
    getUnreadNotificationCount
);

// Mark all as read
router.patch(
    "/read-all",
    protect,
    markAllNotificationsAsRead
);

// Mark one notification as read
router.patch(
    "/:id/read",
    protect,
    markNotificationAsRead
);

// Delete one notification

router.delete(
    "/:id",
    protect,
    deleteNotification
);


module.exports = router;