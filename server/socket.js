const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Identity = require("./models/Identity");
const Profile = require("./models/Profile");
const Conversation = require("./models/Conversation");
const Message = require("./models/Message");
const Community = require("./models/Community");
const CommunityMessage = require("./models/CommunityMessage");
const MeetingRoom = require("./models/MeetingRoom");
const StudyRoom = MeetingRoom;

// In-memory mapping: userId (string) -> Set of socket IDs
const userSockets = new Map();

// In-memory mapping: socket.id -> Set of active meeting room IDs
const socketMeetingRooms = new Map();
const socketStudyRooms = socketMeetingRooms;

const isAuthorizedCommunityMember = (community, userId) => {
    if (!community || !userId) return false;
    const uId = userId.toString();
    const isOwner = community.owner?.toString() === uId;
    const isMod = community.moderators?.some((m) => (m._id ? m._id.toString() === uId : m.toString() === uId));
    const isMember = community.members?.some((m) => (m._id ? m._id.toString() === uId : m.toString() === uId));

    if (!community.isPrivate) return true;
    return isOwner || isMod || isMember;
};

const initSocket = (httpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        },
        pingTimeout: 60000,
        pingInterval: 25000
    });

    // =====================================================
    // SOCKET JWT AUTHENTICATION MIDDLEWARE
    // =====================================================
    io.use(async (socket, next) => {
        try {
            const token =
                socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization?.replace("Bearer ", "");

            if (!token) {
                return next(new Error("Authentication token required"));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (!decoded || !decoded.userId) {
                return next(new Error("Invalid token payload"));
            }

            const user = await Identity.findById(decoded.userId);
            if (!user) {
                return next(new Error("User not found"));
            }

            if (user.status === "BANNED" || user.status === "DELETED") {
                return next(new Error("User account is inactive"));
            }

            const profile = await Profile.findOne({ userId: user._id });

            socket.user = {
                _id: user._id,
                id: user._id.toString(),
                username: user.username,
                displayName: profile?.displayName || user.username,
                avatar: profile?.avatar || "",
                isPro: profile?.isPro || false,
                avatarDecoration: profile?.avatarDecoration || "",
                email: user.email
            };

            next();
        } catch (error) {
            console.error("Socket authentication error:", error.message);
            return next(new Error("Authentication failed: " + error.message));
        }
    });

    // =====================================================
    // CONNECTION & EVENT HANDLING
    // =====================================================
    io.on("connection", (socket) => {
        const userId = socket.user.id;

        if (!userSockets.has(userId)) {
            userSockets.set(userId, new Set());
        }
        const userSocketSet = userSockets.get(userId);
        const wasOffline = userSocketSet.size === 0;
        userSocketSet.add(socket.id);
        socketStudyRooms.set(socket.id, new Set());

        socket.join(`user:${userId}`);

        if (wasOffline) {
            io.emit("user:status", {
                userId,
                status: "online"
            });
        }

        const activeOnlineUsers = Array.from(userSockets.keys()).filter(
            (id) => userSockets.get(id)?.size > 0
        );
        socket.emit("users:online", activeOnlineUsers);

        // =====================================================
        // 1-TO-1 CHAT: JOIN / LEAVE
        // =====================================================
        socket.on("join_conversation", async (data, callback) => {
            try {
                const conversationId = data?.conversationId || data;
                if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
                    if (callback) callback({ success: false, message: "Invalid conversation ID" });
                    return;
                }

                const conversation = await Conversation.findById(conversationId);
                if (!conversation) {
                    if (callback) callback({ success: false, message: "Conversation not found" });
                    return;
                }

                const isParticipant = conversation.participants.some((p) =>
                    p.equals(socket.user._id)
                );

                if (!isParticipant) {
                    if (callback) callback({ success: false, message: "Unauthorized for this room" });
                    return;
                }

                socket.join(conversationId);
                if (callback) callback({ success: true });
            } catch (err) {
                console.error("join_conversation error:", err);
                if (callback) callback({ success: false, message: "Error joining room" });
            }
        });

        socket.on("leave_conversation", (data) => {
            const conversationId = data?.conversationId || data;
            if (conversationId) {
                socket.leave(conversationId);
            }
        });

        // =====================================================
        // 1-TO-1 CHAT: SEND MESSAGE (TEXT / IMAGE)
        // =====================================================
        socket.on("send_message", async (data, callback) => {
            try {
                const {
                    conversationId,
                    content,
                    messageType = "TEXT",
                    mediaUrl,
                    mediaMeta
                } = data || {};

                if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
                    if (callback) callback({ success: false, message: "Invalid conversation ID" });
                    return;
                }

                const trimmed = content?.trim() || "";

                if (messageType === "TEXT" && !trimmed) {
                    if (callback) callback({ success: false, message: "Message cannot be empty" });
                    return;
                }

                if (messageType === "IMAGE" && !mediaUrl) {
                    if (callback) callback({ success: false, message: "Media URL is required for image message" });
                    return;
                }

                if (trimmed.length > 2000) {
                    if (callback) callback({ success: false, message: "Message exceeds 2000 characters limit" });
                    return;
                }

                const conversation = await Conversation.findById(conversationId);
                if (!conversation) {
                    if (callback) callback({ success: false, message: "Conversation not found" });
                    return;
                }

                const isParticipant = conversation.participants.some((p) =>
                    p.equals(socket.user._id)
                );

                if (!isParticipant) {
                    if (callback) callback({ success: false, message: "Unauthorized" });
                    return;
                }

                const message = new Message({
                    conversation: conversation._id,
                    sender: socket.user._id,
                    messageType: messageType || "TEXT",
                    content: trimmed,
                    mediaUrl: mediaUrl || "",
                    mediaMeta: mediaMeta || {},
                    read: false
                });
                await message.save();

                conversation.lastMessage = message._id;
                conversation.lastMessageAt = new Date();
                await conversation.save();

                const populatedMessage = await Message.findById(message._id).populate(
                    "sender",
                    "username"
                );

                const enrichedMessage = {
                    ...populatedMessage.toObject(),
                    sender: {
                        ...populatedMessage.sender.toObject(),
                        displayName: socket.user.displayName,
                        avatar: socket.user.avatar,
                        isPro: socket.user.isPro,
                        avatarDecoration: socket.user.avatarDecoration
                    }
                };

                io.to(conversationId).emit("new_message", {
                    conversationId,
                    message: enrichedMessage
                });

                const recipientId = conversation.participants
                    .find((p) => !p.equals(socket.user._id))
                    ?.toString();

                if (recipientId) {
                    io.to(`user:${recipientId}`).emit("conversation:updated", {
                        conversationId,
                        lastMessage: enrichedMessage,
                        lastMessageAt: conversation.lastMessageAt,
                        incrementUnread: true
                    });
                }

                io.to(`user:${socket.user.id}`).emit("conversation:updated", {
                    conversationId,
                    lastMessage: enrichedMessage,
                    lastMessageAt: conversation.lastMessageAt,
                    incrementUnread: false
                });

                if (callback) {
                    callback({
                        success: true,
                        message: enrichedMessage
                    });
                }
            } catch (err) {
                console.error("send_message socket error:", err);
                if (callback) callback({ success: false, message: "Server error sending message" });
            }
        });

        // =====================================================
        // 1-TO-1 CHAT: DELETE MESSAGE
        // =====================================================
        socket.on("delete_message", async (data, callback) => {
            try {
                const { conversationId, messageId } = data || {};
                if (!conversationId || !messageId) {
                    if (callback) callback({ success: false, message: "Missing conversationId or messageId" });
                    return;
                }

                const message = await Message.findOne({
                    _id: messageId,
                    conversation: conversationId
                });

                if (!message) {
                    if (callback) callback({ success: false, message: "Message not found" });
                    return;
                }

                if (!message.sender.equals(socket.user._id)) {
                    if (callback) callback({ success: false, message: "Unauthorized to delete this message" });
                    return;
                }

                message.isDeleted = true;
                message.deletedAt = new Date();
                await message.save();

                io.to(conversationId).emit("message_deleted", {
                    conversationId,
                    messageId
                });

                if (callback) callback({ success: true, messageId });
            } catch (err) {
                console.error("delete_message socket error:", err);
                if (callback) callback({ success: false, message: "Error deleting message" });
            }
        });

        // =====================================================
        // 1-TO-1 CHAT: TYPING INDICATORS
        // =====================================================
        socket.on("typing:start", async (data) => {
            const { conversationId } = data || {};
            if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) return;

            socket.to(conversationId).emit("typing:start", {
                conversationId,
                userId: socket.user.id,
                username: socket.user.username,
                displayName: socket.user.displayName
            });
        });

        socket.on("typing:stop", (data) => {
            const { conversationId } = data || {};
            if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) return;

            socket.to(conversationId).emit("typing:stop", {
                conversationId,
                userId: socket.user.id
            });
        });

        // =====================================================
        // 1-TO-1 CHAT: READ RECEIPTS
        // =====================================================
        socket.on("mark_read", async (data, callback) => {
            try {
                const { conversationId } = data || {};
                if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
                    if (callback) callback({ success: false });
                    return;
                }

                const result = await Message.updateMany(
                    {
                        conversation: conversationId,
                        sender: { $ne: socket.user._id },
                        read: false
                    },
                    {
                        $set: {
                            read: true,
                            readAt: new Date()
                        }
                    }
                );

                if (result.modifiedCount > 0) {
                    io.to(conversationId).emit("messages_read", {
                        conversationId,
                        readBy: socket.user.id,
                        readAt: new Date()
                    });

                    io.to(`user:${socket.user.id}`).emit("unread:updated", {
                        conversationId
                    });
                }

                if (callback) callback({ success: true, count: result.modifiedCount });
            } catch (err) {
                console.error("mark_read socket error:", err);
                if (callback) callback({ success: false });
            }
        });

        // =====================================================
        // COMMUNITY CHAT: JOIN / LEAVE
        // =====================================================
        socket.on("join_community_chat", async (data, callback) => {
            try {
                const { communityId, channel = "general" } = data || {};

                if (!communityId || !mongoose.Types.ObjectId.isValid(communityId)) {
                    if (callback) callback({ success: false, message: "Invalid community ID" });
                    return;
                }

                const community = await Community.findById(communityId);
                if (!community) {
                    if (callback) callback({ success: false, message: "Community not found" });
                    return;
                }

                if (community.isPrivate && !isAuthorizedCommunityMember(community, socket.user._id)) {
                    if (callback) callback({ success: false, message: "Unauthorized for private community chat" });
                    return;
                }

                const roomName = `community:${communityId}:${channel.toLowerCase().trim()}`;
                socket.join(roomName);

                if (callback) callback({ success: true, channel });
            } catch (err) {
                console.error("join_community_chat error:", err);
                if (callback) callback({ success: false, message: "Error joining community chat" });
            }
        });

        socket.on("leave_community_chat", (data) => {
            const { communityId, channel = "general" } = data || {};
            if (communityId) {
                const roomName = `community:${communityId}:${channel.toLowerCase().trim()}`;
                socket.leave(roomName);
            }
        });

        // =====================================================
        // COMMUNITY CHAT: SEND MESSAGE
        // =====================================================
        socket.on("send_community_message", async (data, callback) => {
            try {
                const {
                    communityId,
                    channel = "general",
                    content,
                    messageType = "TEXT",
                    mediaUrl,
                    mediaMeta
                } = data || {};

                if (!communityId || !mongoose.Types.ObjectId.isValid(communityId)) {
                    if (callback) callback({ success: false, message: "Invalid community ID" });
                    return;
                }

                const community = await Community.findById(communityId);
                if (!community) {
                    if (callback) callback({ success: false, message: "Community not found" });
                    return;
                }

                if (community.isPrivate && !isAuthorizedCommunityMember(community, socket.user._id)) {
                    if (callback) callback({ success: false, message: "Must be a member to send messages" });
                    return;
                }

                const trimmed = content?.trim() || "";
                if (messageType === "TEXT" && !trimmed) {
                    if (callback) callback({ success: false, message: "Message cannot be empty" });
                    return;
                }

                if (messageType === "IMAGE" && !mediaUrl) {
                    if (callback) callback({ success: false, message: "Media URL is required" });
                    return;
                }

                const message = new CommunityMessage({
                    community: community._id,
                    channel: channel.toLowerCase().trim(),
                    sender: socket.user._id,
                    messageType: messageType || "TEXT",
                    content: trimmed,
                    mediaUrl: mediaUrl || "",
                    mediaMeta: mediaMeta || {}
                });
                await message.save();

                const populated = await CommunityMessage.findById(message._id).populate(
                    "sender",
                    "username"
                );

                const ownerIdStr = community.owner?.toString();
                const modIdStrs = new Set(
                    community.moderators?.map((m) => (m._id ? m._id.toString() : m.toString()))
                );

                const sIdStr = socket.user.id;
                let communityRole = "MEMBER";
                if (sIdStr === ownerIdStr) communityRole = "OWNER";
                else if (modIdStrs.has(sIdStr)) communityRole = "MODERATOR";

                const enrichedMessage = {
                    ...populated.toObject(),
                    sender: {
                        ...populated.sender.toObject(),
                        displayName: socket.user.displayName,
                        avatar: socket.user.avatar,
                        isPro: socket.user.isPro,
                        avatarDecoration: socket.user.avatarDecoration,
                        communityRole
                    }
                };

                const roomName = `community:${communityId}:${channel.toLowerCase().trim()}`;
                io.to(roomName).emit("new_community_message", {
                    communityId,
                    channel: channel.toLowerCase().trim(),
                    message: enrichedMessage
                });

                if (callback) callback({ success: true, message: enrichedMessage });
            } catch (err) {
                console.error("send_community_message error:", err);
                if (callback) callback({ success: false, message: "Error sending community message" });
            }
        });

        // =====================================================
        // COMMUNITY CHAT: TYPING INDICATORS
        // =====================================================
        socket.on("community_typing:start", (data) => {
            const { communityId, channel = "general" } = data || {};
            if (!communityId) return;
            const roomName = `community:${communityId}:${channel.toLowerCase().trim()}`;
            socket.to(roomName).emit("community_typing:start", {
                communityId,
                channel,
                userId: socket.user.id,
                username: socket.user.username,
                displayName: socket.user.displayName
            });
        });

        socket.on("community_typing:stop", (data) => {
            const { communityId, channel = "general" } = data || {};
            if (!communityId) return;
            const roomName = `community:${communityId}:${channel.toLowerCase().trim()}`;
            socket.to(roomName).emit("community_typing:stop", {
                communityId,
                channel,
                userId: socket.user.id
            });
        });

        // =====================================================
        // COMMUNITY CHAT: DELETE MESSAGE (AUTHOR / MOD / OWNER)
        // =====================================================
        socket.on("delete_community_message", async (data, callback) => {
            try {
                const { communityId, channel = "general", messageId } = data || {};
                if (!communityId || !messageId) {
                    if (callback) callback({ success: false, message: "Missing communityId or messageId" });
                    return;
                }

                const community = await Community.findById(communityId);
                const message = await CommunityMessage.findOne({
                    _id: messageId,
                    community: communityId
                });

                if (!community || !message) {
                    if (callback) callback({ success: false, message: "Message not found" });
                    return;
                }

                const userIdStr = socket.user.id;
                const isAuthor = message.sender.toString() === userIdStr;
                const isOwner = community.owner?.toString() === userIdStr;
                const isMod = community.moderators?.some(
                    (m) => (m._id ? m._id.toString() : m.toString()) === userIdStr
                );

                if (!isAuthor && !isOwner && !isMod) {
                    if (callback) callback({ success: false, message: "Unauthorized to delete this message" });
                    return;
                }

                message.isDeleted = true;
                message.deletedBy = socket.user._id;
                message.deletedAt = new Date();
                await message.save();

                const roomName = `community:${communityId}:${channel.toLowerCase().trim()}`;
                io.to(roomName).emit("community_message_deleted", {
                    communityId,
                    channel,
                    messageId
                });

                if (callback) callback({ success: true, messageId });
            } catch (err) {
                console.error("delete_community_message socket error:", err);
                if (callback) callback({ success: false, message: "Error deleting community message" });
            }
        });

        // =====================================================
        // WEBRTC MEETING ROOMS: JOIN / LEAVE / SIGNALING
        // =====================================================
        const handleJoinMeetingRoom = async (data, callback) => {
            try {
                const { roomId, passcode } = data || {};

                if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
                    if (callback) callback({ success: false, message: "Invalid meeting room ID" });
                    return;
                }

                const room = await MeetingRoom.findById(roomId).populate("community");
                if (!room || !room.isActive) {
                    if (callback) callback({ success: false, message: "Meeting room is not active" });
                    return;
                }

                // Check if user is banned from the community
                if (room.community?.bannedUsers?.some((b) => (b.user?._id ? b.user._id.equals(socket.user._id) : b.user?.equals?.(socket.user._id)))) {
                    if (callback) callback({ success: false, message: "You are banned from this community" });
                    return;
                }

                if (room.isPrivate && room.passcode && passcode !== room.passcode) {
                    if (callback) callback({ success: false, message: "Incorrect passcode" });
                    return;
                }

                if (room.community && room.community.isPrivate) {
                    if (!isAuthorizedCommunityMember(room.community, socket.user._id)) {
                        if (callback) callback({ success: false, message: "Must be a community member to join" });
                        return;
                    }
                }

                // Enforce Host Tier Limit (5 Free vs 15 Pro)
                const hostProfile = await Profile.findOne({ userId: room.createdBy || room.creator });
                const isHostPro = Boolean(
                    hostProfile?.isPro && (!hostProfile?.proExpiresAt || new Date(hostProfile.proExpiresAt) > new Date())
                );
                const hostTierLimit = isHostPro ? 15 : 5;
                const effectiveMax = Math.min(room.maxParticipants || hostTierLimit, hostTierLimit);

                // Check capacity
                const existingIdx = room.activeParticipants.findIndex((p) => p.user.equals(socket.user._id));
                if (existingIdx < 0 && room.activeParticipants.length >= effectiveMax) {
                    if (callback) callback({
                        success: false,
                        message: `Meeting room is full (Max ${effectiveMax} participants for ${isHostPro ? "ANOY Pro" : "Free"} host)`
                    });
                    return;
                }

                const roomKey = `meeting_room:${roomId}`;
                const legacyKey = `study_room:${roomId}`;
                socket.join(roomKey);
                socket.join(legacyKey);
                socketMeetingRooms.get(socket.id)?.add(roomId);

                // Update participant in DB
                if (existingIdx >= 0) {
                    room.activeParticipants[existingIdx].socketId = socket.id;
                } else {
                    room.activeParticipants.push({
                        user: socket.user._id,
                        socketId: socket.id,
                        joinedAt: new Date(),
                        isMuted: false,
                        isVideoOff: false,
                        isScreenSharing: false
                    });
                }
                await room.save();

                // Find other connected sockets in this room
                const socketsInRoom = await io.in(roomKey).fetchSockets();
                const peers = socketsInRoom
                    .filter((s) => s.id !== socket.id && s.user)
                    .map((s) => ({
                        socketId: s.id,
                        user: s.user
                    }));

                // Broadcast to others that new user joined
                const joinPayload = {
                    socketId: socket.id,
                    user: socket.user
                };
                socket.to(roomKey).emit("meeting_room:user_joined", joinPayload);
                socket.to(legacyKey).emit("study_room:user_joined", joinPayload);

                if (callback) {
                    callback({
                        success: true,
                        peers,
                        room: {
                            _id: room._id,
                            name: room.name || room.title,
                            title: room.name || room.title,
                            topic: room.description || "General"
                        }
                    });
                }
            } catch (err) {
                console.error("join_meeting_room socket error:", err);
                if (callback) callback({ success: false, message: "Error joining meeting room" });
            }
        };

        socket.on("join_meeting_room", handleJoinMeetingRoom);
        socket.on("join_study_room", handleJoinMeetingRoom);

        const handleLeaveMeetingRoom = async (data, callback) => {
            try {
                const { roomId } = data || {};
                if (!roomId) return;

                const roomKey = `meeting_room:${roomId}`;
                const legacyKey = `study_room:${roomId}`;
                socket.leave(roomKey);
                socket.leave(legacyKey);
                socketMeetingRooms.get(socket.id)?.delete(roomId);

                const leavePayload = {
                    socketId: socket.id,
                    userId: socket.user.id
                };
                socket.to(roomKey).emit("meeting_room:user_left", leavePayload);
                socket.to(legacyKey).emit("study_room:user_left", leavePayload);

                const room = await MeetingRoom.findById(roomId);
                if (room) {
                    room.activeParticipants = room.activeParticipants.filter(
                        (p) => !p.user.equals(socket.user._id)
                    );
                    await room.save();
                }

                if (callback) callback({ success: true });
            } catch (err) {
                console.error("leave_meeting_room error:", err);
                if (callback) callback({ success: false });
            }
        };

        socket.on("leave_meeting_room", handleLeaveMeetingRoom);
        socket.on("leave_study_room", handleLeaveMeetingRoom);

        // WebRTC Signaling Relay
        const handleSignal = (data) => {
            const { toSocketId, signalData, type } = data || {};
            if (!toSocketId) return;

            const signalPayload = {
                fromSocketId: socket.id,
                user: socket.user,
                signalData,
                type
            };
            io.to(toSocketId).emit("meeting_room:signal", signalPayload);
            io.to(toSocketId).emit("study_room:signal", signalPayload);
        };

        socket.on("meeting_room:signal", handleSignal);
        socket.on("study_room:signal", handleSignal);

        // Participant State Changes (Mute / Camera / Screen Share)
        const handleStateChange = async (data) => {
            const { roomId, isMuted, isVideoOff, isScreenSharing } = data || {};
            if (!roomId) return;

            const roomKey = `meeting_room:${roomId}`;
            const legacyKey = `study_room:${roomId}`;
            const statePayload = {
                socketId: socket.id,
                userId: socket.user.id,
                isMuted,
                isVideoOff,
                isScreenSharing
            };
            socket.to(roomKey).emit("meeting_room:participant_state_changed", statePayload);
            socket.to(legacyKey).emit("study_room:participant_state_changed", statePayload);

            // Update in DB
            MeetingRoom.findById(roomId).then((room) => {
                if (room) {
                    const p = room.activeParticipants.find((item) => item.user.equals(socket.user._id));
                    if (p) {
                        if (typeof isMuted === "boolean") p.isMuted = isMuted;
                        if (typeof isVideoOff === "boolean") p.isVideoOff = isVideoOff;
                        if (typeof isScreenSharing === "boolean") p.isScreenSharing = isScreenSharing;
                        room.save();
                    }
                }
            }).catch((e) => console.warn("meeting_room:state_change db update error:", e));
        };

        socket.on("meeting_room:state_change", handleStateChange);
        socket.on("study_room:state_change", handleStateChange);

        // =====================================================
        // DISCONNECT
        // =====================================================
        socket.on("disconnect", async () => {
            // Clean up from meeting rooms
            const joinedRooms = socketMeetingRooms.get(socket.id);
            if (joinedRooms && joinedRooms.size > 0) {
                for (const rId of joinedRooms) {
                    const roomKey = `meeting_room:${rId}`;
                    const legacyKey = `study_room:${rId}`;
                    const leavePayload = {
                        socketId: socket.id,
                        userId: socket.user.id
                    };
                    socket.to(roomKey).emit("meeting_room:user_left", leavePayload);
                    socket.to(legacyKey).emit("study_room:user_left", leavePayload);

                    MeetingRoom.findById(rId).then((room) => {
                        if (room) {
                            room.activeParticipants = room.activeParticipants.filter(
                                (p) => !p.user.equals(socket.user._id)
                            );
                            room.save();
                        }
                    }).catch(() => {});
                }
                socketMeetingRooms.delete(socket.id);
            }

            const userSet = userSockets.get(userId);
            if (userSet) {
                userSet.delete(socket.id);
                if (userSet.size === 0) {
                    userSockets.delete(userId);
                    io.emit("user:status", {
                        userId,
                        status: "offline",
                        lastSeen: new Date()
                    });
                }
            }
        });
    });

    return io;
};

module.exports = { initSocket };
