const mongoose = require("mongoose");
const MeetingRoom = require("../models/MeetingRoom");
const Community = require("../models/Community");
const Profile = require("../models/Profile");

const isAuthorizedCommunityMember = (community, userId) => {
    if (!community || !userId) return false;
    const uId = userId.toString();
    const isOwner = community.owner?.toString() === uId;
    const isMod = community.moderators?.some((m) => (m._id ? m._id.toString() === uId : m.toString() === uId));
    const isMember = community.members?.some((m) => (m._id ? m._id.toString() === uId : m.toString() === uId));

    if (!community.isPrivate) return true;
    return isOwner || isMod || isMember;
};

/**
 * Resolve community by ID or slug
 */
const resolveCommunity = async (communityIdentifier) => {
    if (!communityIdentifier) return null;
    if (mongoose.Types.ObjectId.isValid(communityIdentifier)) {
        const byId = await Community.findById(communityIdentifier);
        if (byId) return byId;
    }
    return await Community.findOne({ slug: communityIdentifier.toLowerCase().trim() });
};

/**
 * GET /api/v1/communities/:communityId/meeting-rooms
 * List all active meeting rooms for a specific community
 */
const getCommunityMeetingRooms = async (req, res) => {
    try {
        const communityIdentifier = req.params.communityId || req.query.communityId;
        let community = null;

        if (communityIdentifier) {
            community = await resolveCommunity(communityIdentifier);
            if (!community) {
                return res.status(404).json({
                    success: false,
                    message: "Community not found"
                });
            }

            // Private community access check
            if (community.isPrivate && req.user) {
                const isMember = isAuthorizedCommunityMember(community, req.user._id);
                if (!isMember) {
                    return res.status(403).json({
                        success: false,
                        message: "You must be a member of this private community to access its meeting rooms"
                    });
                }
            }
        }

        const { q } = req.query;
        const filter = {
            isActive: true
        };

        if (community) {
            filter.community = community._id;
        }

        if (q) {
            filter.$or = [
                { name: { $regex: q.trim(), $options: "i" } },
                { title: { $regex: q.trim(), $options: "i" } },
                { description: { $regex: q.trim(), $options: "i" } }
            ];
        }

        const rooms = await MeetingRoom.find(filter)
            .populate("createdBy", "username")
            .populate("community", "name slug avatar isPrivate")
            .populate("activeParticipants.user", "username")
            .sort({ createdAt: -1 })
            .limit(50);

        // Pre-fetch participant profiles
        const allUserIds = new Set();
        rooms.forEach((r) => {
            if (r.createdBy?._id) allUserIds.add(r.createdBy._id.toString());
            r.activeParticipants?.forEach((p) => {
                if (p.user?._id) allUserIds.add(p.user._id.toString());
            });
        });

        const profiles = await Profile.find({ userId: { $in: Array.from(allUserIds) } });
        const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

        const enrichedRooms = rooms.map((room) => {
            const rObj = room.toObject();
            const creatorProf = rObj.createdBy ? profileMap.get(rObj.createdBy._id.toString()) : null;

            rObj.name = rObj.name || rObj.title;
            rObj.title = rObj.name;
            rObj.createdBy = rObj.createdBy
                ? {
                      ...rObj.createdBy,
                      displayName: creatorProf?.displayName || rObj.createdBy.username,
                      avatar: creatorProf?.avatar || "",
                      isPro: creatorProf?.isPro || false
                  }
                : null;
            rObj.creator = rObj.createdBy;

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

            return rObj;
        });

        return res.status(200).json({
            success: true,
            count: enrichedRooms.length,
            community: community
                ? {
                      _id: community._id,
                      name: community.name,
                      slug: community.slug,
                      isPrivate: community.isPrivate
                  }
                : null,
            rooms: enrichedRooms,
            meetingRooms: enrichedRooms
        });
    } catch (error) {
        console.error("Get community meeting rooms error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error retrieving meeting rooms"
        });
    }
};

/**
 * POST /api/v1/communities/:communityId/meeting-rooms
 * Create a new meeting room inside a community
 */
const createMeetingRoom = async (req, res) => {
    try {
        const communityIdentifier = req.params.communityId || req.body.communityId || req.body.community;
        let community = null;

        if (communityIdentifier) {
            community = await resolveCommunity(communityIdentifier);
        }

        if (!community) {
            community = await Community.findOne({ isPrivate: false });
            if (!community) {
                community = await Community.create({
                    name: "Campus Commons",
                    slug: "campus-commons",
                    description: "University-wide open community",
                    owner: req.user._id,
                    members: [req.user._id],
                    isPrivate: false
                });
            }
        }

        // Verify community membership
        const isMember = isAuthorizedCommunityMember(community, req.user._id);
        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: "You must be a member of this community to create a meeting room"
            });
        }

        const {
            name,
            title,
            description = "",
            isPrivate = false,
            passcode = "",
            maxParticipants = 10
        } = req.body;

        const roomName = (name || title || "").trim();
        if (!roomName) {
            return res.status(400).json({
                success: false,
                message: "Meeting room name is required"
            });
        }

        const parsedMax = Math.min(Math.max(parseInt(maxParticipants, 10) || 10, 2), 30);

        const room = await MeetingRoom.create({
            name: roomName,
            title: roomName,
            description: description.trim(),
            community: community._id,
            createdBy: req.user._id,
            creator: req.user._id,
            isPrivate: Boolean(isPrivate || passcode),
            passcode: passcode ? passcode.trim() : "",
            maxParticipants: parsedMax,
            activeParticipants: [
                {
                    user: req.user._id,
                    joinedAt: new Date(),
                    isMuted: false,
                    isVideoOff: false,
                    isScreenSharing: false
                }
            ],
            isActive: true
        });

        const populatedRoom = await MeetingRoom.findById(room._id)
            .populate("createdBy", "username")
            .populate("community", "name slug avatar isPrivate");

        const roomObj = populatedRoom.toObject();
        roomObj.hasPasscode = Boolean(room.passcode);
        delete roomObj.passcode;

        return res.status(201).json({
            success: true,
            message: "Meeting room created successfully",
            room: roomObj,
            meetingRoom: roomObj
        });
    } catch (error) {
        console.error("Create meeting room error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to create meeting room"
        });
    }
};

/**
 * GET /api/v1/meeting-rooms/:id
 * Retrieve details for a single meeting room
 */
const getMeetingRoom = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid meeting room ID"
            });
        }

        const room = await MeetingRoom.findById(id)
            .populate("createdBy", "username")
            .populate("community", "name slug avatar isPrivate owner moderators members")
            .populate("activeParticipants.user", "username");

        if (!room || !room.isActive) {
            return res.status(404).json({
                success: false,
                message: "Meeting room not found or is inactive"
            });
        }

        // Access check if community is private
        if (room.community && room.community.isPrivate && req.user) {
            const isMember = isAuthorizedCommunityMember(room.community, req.user._id);
            if (!isMember) {
                return res.status(403).json({
                    success: false,
                    message: "You must be a member of this community to access this meeting room"
                });
            }
        }

        // Pre-fetch participant profiles
        const allUserIds = new Set();
        if (room.createdBy?._id) allUserIds.add(room.createdBy._id.toString());
        room.activeParticipants?.forEach((p) => {
            if (p.user?._id) allUserIds.add(p.user._id.toString());
        });

        const profiles = await Profile.find({ userId: { $in: Array.from(allUserIds) } });
        const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

        const rObj = room.toObject();
        const creatorProf = rObj.createdBy ? profileMap.get(rObj.createdBy._id.toString()) : null;

        rObj.name = rObj.name || rObj.title;
        rObj.title = rObj.name;
        rObj.createdBy = rObj.createdBy
            ? {
                  ...rObj.createdBy,
                  displayName: creatorProf?.displayName || rObj.createdBy.username,
                  avatar: creatorProf?.avatar || "",
                  isPro: creatorProf?.isPro || false,
                  avatarDecoration: creatorProf?.avatarDecoration || ""
              }
            : null;
        rObj.creator = rObj.createdBy;

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
            room: rObj,
            meetingRoom: rObj
        });
    } catch (error) {
        console.error("Get meeting room error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error retrieving meeting room"
        });
    }
};

/**
 * POST /api/v1/meeting-rooms/:id/join
 * Join a meeting room with passcode / authorization check
 */
const joinMeetingRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const { passcode } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid meeting room ID"
            });
        }

        const room = await MeetingRoom.findById(id).populate("community");
        if (!room || !room.isActive) {
            return res.status(404).json({
                success: false,
                message: "Meeting room is not active or does not exist"
            });
        }

        // Community membership verification for private communities
        if (room.community && room.community.isPrivate) {
            const isMember = isAuthorizedCommunityMember(room.community, req.user._id);
            if (!isMember) {
                return res.status(403).json({
                    success: false,
                    message: "You must be a member of this community to join this meeting room"
                });
            }
        }

        // Passcode verification
        if (room.isPrivate && room.passcode) {
            if (!passcode || passcode.trim() !== room.passcode.trim()) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid meeting room passcode"
                });
            }
        }

        // Check room capacity
        const isAlreadyIn = room.activeParticipants.some((p) => p.user.equals(req.user._id));
        if (!isAlreadyIn && room.activeParticipants.length >= room.maxParticipants) {
            return res.status(400).json({
                success: false,
                message: `Meeting room is full (Max ${room.maxParticipants} participants)`
            });
        }

        // Add to activeParticipants if not already present
        if (!isAlreadyIn) {
            room.activeParticipants.push({
                user: req.user._id,
                joinedAt: new Date(),
                isMuted: false,
                isVideoOff: false,
                isScreenSharing: false
            });
            await room.save();
        }

        return res.status(200).json({
            success: true,
            message: "Joined meeting room successfully",
            room: {
                _id: room._id,
                name: room.name || room.title,
                title: room.name || room.title,
                community: room.community
            }
        });
    } catch (error) {
        console.error("Join meeting room error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error joining meeting room"
        });
    }
};

/**
 * POST /api/v1/meeting-rooms/:id/leave
 * Leave a meeting room
 */
const leaveMeetingRoom = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid meeting room ID"
            });
        }

        const room = await MeetingRoom.findById(id);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Meeting room not found"
            });
        }

        room.activeParticipants = room.activeParticipants.filter(
            (p) => !p.user.equals(req.user._id)
        );
        await room.save();

        return res.status(200).json({
            success: true,
            message: "Left meeting room successfully"
        });
    } catch (error) {
        console.error("Leave meeting room error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error leaving meeting room"
        });
    }
};

/**
 * DELETE /api/v1/meeting-rooms/:id
 * Delete / end meeting room (Creator, Community Owner, or Moderator)
 */
const deleteMeetingRoom = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid meeting room ID"
            });
        }

        const room = await MeetingRoom.findById(id).populate("community");
        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Meeting room not found"
            });
        }

        const isCreator = (room.createdBy || room.creator)?.equals(req.user._id);
        const isCommOwner = room.community?.owner?.equals(req.user._id);
        const isCommMod = room.community?.moderators?.some((m) =>
            m._id ? m._id.equals(req.user._id) : m.equals(req.user._id)
        );

        if (!isCreator && !isCommOwner && !isCommMod) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to delete this meeting room"
            });
        }

        room.isActive = false;
        await room.save();

        return res.status(200).json({
            success: true,
            message: "Meeting room closed successfully"
        });
    } catch (error) {
        console.error("Delete meeting room error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error deleting meeting room"
        });
    }
};

module.exports = {
    getCommunityMeetingRooms,
    createMeetingRoom,
    getMeetingRoom,
    joinMeetingRoom,
    leaveMeetingRoom,
    deleteMeetingRoom
};
