const Notification = require("../models/Notification");

// =====================================================
// GET MY NOTIFICATIONS WITH PAGINATION
// =====================================================

const getMyNotifications = async (req, res) => {

    try {

        // Get page and limit from query parameters
        const page = Math.max(
            parseInt(req.query.page) || 1,
            1
        );

        const limit = Math.min(
            Math.max(parseInt(req.query.limit) || 20, 1),
            100
        );

        // Calculate how many documents to skip
        const skip = (page - 1) * limit;


        // Get total notifications for this user
        const total = await Notification.countDocuments({
            recipient: req.user._id
        });


        // Get notifications
        const notifications =
            await Notification.find({
                recipient: req.user._id
            })
            .populate(
                "sender",
                "username"
            )
            .sort({
                createdAt: -1
            })
            .skip(skip)
            .limit(limit);


        return res.status(200).json({

            success: true,

            count: notifications.length,

            page,

            limit,

            total,

            totalPages:
                Math.ceil(total / limit),

            notifications

        });


    } catch (error) {

        console.error(
            "Get notifications error:",
            error
        );


        return res.status(500).json({

            success: false,

            message: "Server error"

        });

    }

};

// =====================================================
// MARK NOTIFICATION AS READ
// =====================================================

const markNotificationAsRead = async (req, res) => {
    try {

        const notification =
            await Notification.findOne({
                _id: req.params.id,
                recipient: req.user._id
            });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
            });
        }

        notification.read = true;

        await notification.save();

        return res.status(200).json({
            success: true,
            message: "Notification marked as read",
            notification
        });

    } catch (error) {

        console.error(
            "Mark notification read error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// =====================================================
// MARK ALL NOTIFICATIONS AS READ
// =====================================================

const markAllNotificationsAsRead = async (req, res) => {
    try {

        await Notification.updateMany(
            {
                recipient: req.user._id,
                read: false
            },
            {
                $set: {
                    read: true
                }
            }
        );

        return res.status(200).json({
            success: true,
            message: "All notifications marked as read"
        });

    } catch (error) {

        console.error(
            "Mark all notifications read error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// =====================================================
// GET UNREAD NOTIFICATION COUNT
// =====================================================

const getUnreadNotificationCount = async (req, res) => {
    try {

        const count = await Notification.countDocuments({
            recipient: req.user._id,
            read: false
        });

        return res.status(200).json({
            success: true,
            count
        });

    } catch (error) {

        console.error(
            "Get unread notification count error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// =====================================================
// DELETE NOTIFICATION
// =====================================================

const deleteNotification = async (req, res) => {

    try {

        const notification =
            await Notification.findOneAndDelete({

                _id: req.params.id,

                recipient: req.user._id

            });


        if (!notification) {

            return res.status(404).json({

                success: false,

                message: "Notification not found"

            });

        }


        return res.status(200).json({

            success: true,

            message: "Notification deleted successfully"

        });

    } catch (error) {

        console.error(
            "Delete notification error:",
            error
        );


        return res.status(500).json({

            success: false,

            message: "Server error"

        });

    }

};


module.exports = {
    getMyNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification
};