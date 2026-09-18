const mongoose = require("mongoose");
const StudyRoom = require("../models/StudyRoom");
const Community = require("../models/Community");
const Profile = require("../models/Profile");

/**
 * GET /api/v1/study-rooms
 * List all active study rooms
 */
const getStudyRooms = async (req, res) => {
    try {
        const { topic, communityId, q } = req.query;
        const filter = { isActive: true };

        if (topic && topic !== "All") {
            filter.topic = topic;
        }

        if (communityId && mongoose.Types.ObjectId.isValid(communityId)) {
            filter.community = communityId;
        }

        if (q) {
            filter.$or = [
                { title: { $regex: q.trim(), $options: "i" } },
                { description: { $regex: q.trim(), $options: "i" } },
                { topic: { $regex: q.trim(), $options: "i" } }
            ];
        }

        const rooms = await StudyRoom.find(filter)
            .populate("creator", "username")
            .populate("community", "name slug avatar isPrivate")
            .populate("activeParticipants.user", "username")
            .sort({ createdAt: -1 })
            .limit(50);

        // Pre-fetch participant profiles
        const allUserIds = new Set();
        rooms.forEach((r) => {
            if (r.creator?._id) allUserIds.add(r.creator._id.toString());
            r.activeParticipants?.forEach((p) => {
                if (p.user?._id) allUserIds.add(p.user._id.toString());
            });
        });

        const profiles = await Profile.find({ userId: { $in: Array.from(allUserIds) } });
        const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

        const enrichedRooms = rooms.map((room) => {
            const rObj = room.toObject();
            const creatorProf = rObj.creator ? profileMap.get(rObj.creator._id.toString()) : null;

            rObj.creator = rObj.creator
                ? {
                      ...rObj.creator,
                      displayName: creatorProf?.displayName || rObj.creator.username,
                      avatar: creatorProf?.avatar || "",
                      isPro: creatorProf?.isPro || false
                  }
                : null;

            rObj.activeParticipants = (rObj.activeParticipants || []).map((p) => {
                const uProf = p.user ? profileMap.get(p.user._id.toString()) : null;
                return {
                    ...p,
                    user: p.user
                        ? {
                              ...p.user,
                              displayName: uProf?.displayName || p.user.username,
                              avatar: uProf?.avatar || "",
                              isPro: uProf?.isPro || false,
                              avatarDecoration: uProf?.avatarDecoration || ""
                          }
                        : null
                };
            });

            rObj.hasPasscode = Boolean(room.passcode);
            delete rObj.passcode; // Hide passcode from listing

            return rObj;
        });

        return res.status(200).json({
            success: true,
            count: enrichedRooms.length,
            rooms: enrichedRooms
        });
    } catch (error) {
        console.error("Get study rooms error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error retrieving study rooms"
        });
    }
};

/**
 * GET /api/v1/study-rooms/:id
 * Retrieve single study room with active participants
 */
const getStudyRoomById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid study room ID format"
            });
        }

        const room = await StudyRoom.findById(id)
            .populate("creator", "username")
            .populate("community", "name slug avatar isPrivate owner moderators members")
            .populate("activeParticipants.user", "username");

        if (!room || !room.isActive) {
            return res.status(404).json({
                success: false,
                message: "Study room not found or is no longer active"
            });
        }

        // Gating for community-linked private rooms
        if (room.community && room.community.isPrivate) {
            const uId = req.user._id.toString();
            const isMember =
                room.community.owner?.toString() === uId ||
                room.community.moderators?.some((m) => (m._id ? m._id.toString() === uId : m.toString() === uId)) ||
                room.community.members?.some((m) => (m._id ? m._id.toString() === uId : m.toString() === uId));

            if (!isMember) {
                return res.status(403).json({
                    success: false,
                    message: "You must be a member of this community to access this study room."
                });
            }
        }

        const allUserIds = [
            room.creator?._id?.toString(),
            ...(room.activeParticipants || []).map((p) => p.user?._id?.toString())
        ].filter(Boolean);

        const profiles = await Profile.find({ userId: { $in: allUserIds } });
        const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

        const rObj = room.toObject();
        const creatorProf = rObj.creator ? profileMap.get(rObj.creator._id.toString()) : null;

        rObj.creator = rObj.creator
            ? {
                  ...rObj.creator,
                  displayName: creatorProf?.displayName || rObj.creator.username,
                  avatar: creatorProf?.avatar || "",
                  isPro: creatorProf?.isPro || false
              }
            : null;

        rObj.activeParticipants = (rObj.activeParticipants || []).map((p) => {
            const uProf = p.user ? profileMap.get(p.user._id.toString()) : null;
            return {
                ...p,
                user: p.user
                    ? {
                          ...p.user,
                          displayName: uProf?.displayName || p.user.username,
                          avatar: uProf?.avatar || "",
                          isPro: uProf?.isPro || false,
                          avatarDecoration: uProf?.avatarDecoration || ""
                      }
                    : null
            };
        });

        rObj.hasPasscode = Boolean(room.passcode);
        delete rObj.passcode;

        return res.status(200).json({
            success: true,
            room: rObj
        });
    } catch (error) {
        console.error("Get study room by ID error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error retrieving study room"
        });
    }
};

/**
 * POST /api/v1/study-rooms
 * Create a new study room
 */
const createStudyRoom = async (req, res) => {
    try {
        const {
            title,
            description,
            topic = "General Study",
            communityId,
            isPrivate = false,
            passcode,
            maxParticipants = 8
        } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({
                success: false,
                message: "Room title is required"
            });
        }

        let validCommunityId = null;
        if (communityId) {
            if (!mongoose.Types.ObjectId.isValid(communityId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid community ID format"
                });
            }

            const community = await Community.findById(communityId);
            if (!community) {
                return res.status(404).json({
                    success: false,
                    message: "Associated community not found"
                });
            }

            if (community.isPrivate) {
                const uId = req.user._id.toString();
                const isMember =
                    community.owner?.toString() === uId ||
                    community.moderators?.some((m) => (m._id ? m._id.toString() === uId : m.toString() === uId)) ||
                    community.members?.some((m) => (m._id ? m._id.toString() === uId : m.toString() === uId));

                if (!isMember) {
                    return res.status(403).json({
                        success: false,
                        message: "You must be a member of this community to create study rooms inside it."
                    });
                }
            }
            validCommunityId = community._id;
        }

        const room = new StudyRoom({
            title: title.trim(),
            description: (description || "").trim(),
            topic: (topic || "General Study").trim(),
            creator: req.user._id,
            community: validCommunityId,
            isPrivate: Boolean(isPrivate),
            passcode: isPrivate && passcode ? passcode.trim() : "",
            maxParticipants: Math.min(Math.max(parseInt(maxParticipants) || 8, 2), 20),
            activeParticipants: [],
            isActive: true
        });

        await room.save();

        const populated = await StudyRoom.findById(room._id)
            .populate("creator", "username")
            .populate("community", "name slug avatar");

        return res.status(201).json({
            success: true,
            message: "Study room created successfully",
            room: populated
        });
    } catch (error) {
        console.error("Create study room error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error creating study room"
        });
    }
};

/**
 * POST /api/v1/study-rooms/:id/join
 * Validate authorization & register active participant
 */
const joinStudyRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const { passcode } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid study room ID format"
            });
        }

        const room = await StudyRoom.findById(id).populate("community");
        if (!room || !room.isActive) {
            return res.status(404).json({
                success: false,
                message: "Study room is not active"
            });
        }

        // Passcode verification for private room
        if (room.isPrivate && room.passcode) {
            if (passcode !== room.passcode) {
                return res.status(401).json({
                    success: false,
                    message: "Incorrect passcode for this private study room"
                });
            }
        }

        // Community gating
        if (room.community && room.community.isPrivate) {
            const uId = req.user._id.toString();
            const isMember =
                room.community.owner?.toString() === uId ||
                room.community.moderators?.some((m) => (m._id ? m._id.toString() === uId : m.toString() === uId)) ||
                room.community.members?.some((m) => (m._id ? m._id.toString() === uId : m.toString() === uId));

            if (!isMember) {
                return res.status(403).json({
                    success: false,
                    message: "You must be a member of this community to join this study room."
                });
            }
        }

        // Check & enforce max participant capacity atomically
        const isAlreadyIn = room.activeParticipants.some((p) => p.user.equals(req.user._id));
        if (!isAlreadyIn) {
            const updatedRoom = await StudyRoom.findOneAndUpdate(
                {
                    _id: room._id,
                    isActive: true,
                    "activeParticipants.user": { $ne: req.user._id },
                    $expr: { $lt: [{ $size: "$activeParticipants" }, "$maxParticipants"] }
                },
                {
                    $push: {
                        activeParticipants: {
                            user: req.user._id,
                            joinedAt: new Date(),
                            isMuted: false,
                            isVideoOff: false,
                            isScreenSharing: false
                        }
                    }
                },
                { returnDocument: "after" }
            );

            if (!updatedRoom) {
                return res.status(400).json({
                    success: false,
                    message: "Study room has reached maximum capacity."
                });
            }
        }

        return res.status(200).json({
            success: true,
            message: "Joined study room successfully"
        });
    } catch (error) {
        console.error("Join study room error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error joining study room"
        });
    }
};

/**
 * POST /api/v1/study-rooms/:id/leave
 */
const leaveStudyRoom = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid study room ID format"
            });
        }

        const room = await StudyRoom.findById(id);
        if (room) {
            room.activeParticipants = room.activeParticipants.filter(
                (p) => !p.user.equals(req.user._id)
            );
            await room.save();
        }

        return res.status(200).json({
            success: true,
            message: "Left study room successfully"
        });
    } catch (error) {
        console.error("Leave study room error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error leaving study room"
        });
    }
};

/**
 * DELETE /api/v1/study-rooms/:id
 * Delete / Close study room (Creator only)
 */
const deleteStudyRoom = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid study room ID format"
            });
        }

        const room = await StudyRoom.findById(id);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Study room not found"
            });
        }

        if (!room.creator.equals(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: "Only the creator can delete this study room"
            });
        }

        room.isActive = false;
        room.activeParticipants = [];
        await room.save();

        return res.status(200).json({
            success: true,
            message: "Study room closed successfully"
        });
    } catch (error) {
        console.error("Delete study room error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error closing study room"
        });
    }
};

module.exports = {
    getStudyRooms,
    getStudyRoomById,
    createStudyRoom,
    joinStudyRoom,
    leaveStudyRoom,
    deleteStudyRoom
};
