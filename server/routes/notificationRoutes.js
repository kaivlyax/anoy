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


router.get(
    "/",
    protect,
    getMyNotifications
);

router.get(
    "/unread-count",
    protect,
    getUnreadNotificationCount
);

router.patch(
    "/read-all",
    protect,
    markAllNotificationsAsRead
);

router.patch(
    "/:id/read",
    protect,
    markNotificationAsRead
);


router.delete(
    "/:id",
    protect,
    deleteNotification
);


module.exports = router;