const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const {
    getSettings,
    changePassword,
    updatePrivacy,
    updateNotifications,
    getBlockedUsers,
    blockUser,
    unblockUser,
    logoutAllDevices,
    deleteAccount
} = require("../controllers/settingsController");
const protect = require("../middleware/authMiddleware");
const Identity = require("../models/Identity");
const Profile = require("../models/Profile");
const Block = require("../models/Block");
const Follow = require("../models/Follow");
const Post = require("../models/Post");
const Community = require("../models/Community");
const Comment = require("../models/Comment");
const Like = require("../models/Like");
const Notification = require("../models/Notification");

describe("Settings & Account Management Controller Unit Tests", () => {
    const mockUserId = new mongoose.Types.ObjectId();
    const mockUser = {
        _id: mockUserId,
        username: "testuser",
        email: "testuser@example.com",
        loginProvider: "email",
        emailVerified: true,
        status: "ACTIVE",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
        tokenVersion: 0,
        createdAt: new Date(),
        save: jest.fn().mockResolvedValue(true)
    };

    const mockProfile = {
        userId: mockUserId,
        username: "testuser",
        displayName: "Test User",
        bio: "Bio here",
        avatar: "https://example.com/avatar.jpg",
        coverImage: "",
        isPro: true,
        proPlan: "PRO_MONTHLY",
        proExpiresAt: new Date(Date.now() + 86400000),
        privacy: "PUBLIC",
        messagePrivacy: "EVERYONE",
        notificationPreferences: {
            likes: true,
            comments: true,
            follows: true,
            messages: true,
            communities: true
        }
    };

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("1. getSettings: Returns complete account, profile, privacy, and notifications payload", async () => {
        jest.spyOn(Identity, "findById").mockReturnValue({
            select: jest.fn().mockResolvedValue(mockUser)
        });
        jest.spyOn(Profile, "findOne").mockResolvedValue(mockProfile);

        const req = { user: mockUser };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await getSettings(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                settings: expect.objectContaining({
                    account: expect.objectContaining({
                        username: "testuser",
                        email: "testuser@example.com"
                    }),
                    profile: expect.objectContaining({
                        isPro: true
                    }),
                    privacy: expect.objectContaining({
                        privacy: "PUBLIC",
                        messagePrivacy: "EVERYONE"
                    }),
                    notifications: expect.objectContaining({
                        likes: true
                    })
                })
            })
        );
    });

    test("2. changePassword: Rejects when password is too short", async () => {
        const req = {
            user: mockUser,
            body: {
                currentPassword: "oldPassword123",
                newPassword: "short"
            }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await changePassword(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                message: "New password must be at least 8 characters"
            })
        );
    });

    test("3. changePassword: Rejects when current password does not match", async () => {
        jest.spyOn(Identity, "findById").mockResolvedValue({ ...mockUser, save: jest.fn() });
        jest.spyOn(bcrypt, "compare").mockResolvedValue(false);

        const req = {
            user: mockUser,
            body: {
                currentPassword: "WrongPassword123!",
                newPassword: "NewSecurePassword456!"
            }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await changePassword(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                message: "Current password is incorrect"
            })
        );
    });

    test("4. changePassword: Valid password updates hash, increments tokenVersion, returns new JWT", async () => {
        const saveMock = jest.fn().mockResolvedValue(true);
        const userInstance = { ...mockUser, save: saveMock };
        jest.spyOn(Identity, "findById").mockResolvedValue(userInstance);
        jest.spyOn(bcrypt, "compare").mockResolvedValue(true);
        jest.spyOn(bcrypt, "hash").mockResolvedValue("new_hashed_password");

        const req = {
            user: mockUser,
            body: {
                currentPassword: "CorrectOldPassword123!",
                newPassword: "NewValidPassword456!"
            }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await changePassword(req, res);

        expect(saveMock).toHaveBeenCalled();
        expect(userInstance.tokenVersion).toBe(1);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                message: "Password changed successfully",
                token: expect.any(String)
            })
        );
    });

    test("5. updatePrivacy: Updates privacy and messagePrivacy fields", async () => {
        const updatedProf = { ...mockProfile, privacy: "PRIVATE", messagePrivacy: "FOLLOWERS_ONLY" };
        jest.spyOn(Profile, "findOneAndUpdate").mockResolvedValue(updatedProf);

        const req = {
            user: mockUser,
            body: {
                privacy: "PRIVATE",
                messagePrivacy: "FOLLOWERS_ONLY"
            }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await updatePrivacy(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            message: "Privacy settings updated successfully",
            privacy: {
                privacy: "PRIVATE",
                messagePrivacy: "FOLLOWERS_ONLY"
            }
        });
    });

    test("6. updateNotifications: Updates notification boolean preferences", async () => {
        const updatedProf = {
            ...mockProfile,
            notificationPreferences: {
                likes: false,
                comments: true,
                follows: true,
                messages: true,
                communities: true
            }
        };
        jest.spyOn(Profile, "findOneAndUpdate").mockResolvedValue(updatedProf);

        const req = {
            user: mockUser,
            body: {
                likes: false
            }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await updateNotifications(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            message: "Notification preferences updated successfully",
            notifications: expect.objectContaining({
                likes: false
            })
        });
    });

    test("7. blockUser: Cannot block yourself", async () => {
        const req = {
            user: mockUser,
            params: { username: "testuser" }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await blockUser(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                message: "You cannot block yourself"
            })
        );
    });

    test("8. blockUser: Upserts block and severs mutual follows", async () => {
        const targetUserId = new mongoose.Types.ObjectId();
        jest.spyOn(Identity, "findOne").mockResolvedValue({
            _id: targetUserId,
            username: "targetuser"
        });
        const blockUpsertSpy = jest.spyOn(Block, "findOneAndUpdate").mockResolvedValue(true);
        const followDeleteSpy = jest.spyOn(Follow, "deleteMany").mockResolvedValue({ deletedCount: 1 });

        const req = {
            user: mockUser,
            params: { username: "targetuser" }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await blockUser(req, res);

        expect(blockUpsertSpy).toHaveBeenCalled();
        expect(followDeleteSpy).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                message: "User @targetuser has been blocked."
            })
        );
    });

    test("9. unblockUser: Removes block entry", async () => {
        const targetUserId = new mongoose.Types.ObjectId();
        jest.spyOn(Identity, "findOne").mockResolvedValue({
            _id: targetUserId,
            username: "targetuser"
        });
        const blockDeleteSpy = jest.spyOn(Block, "findOneAndDelete").mockResolvedValue(true);

        const req = {
            user: mockUser,
            params: { username: "targetuser" }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await unblockUser(req, res);

        expect(blockDeleteSpy).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                message: "User @targetuser has been unblocked."
            })
        );
    });

    test("10. logoutAllDevices: Increments tokenVersion to invalidate other active sessions", async () => {
        const saveMock = jest.fn().mockResolvedValue(true);
        const userInstance = { ...mockUser, tokenVersion: 2, save: saveMock };
        jest.spyOn(Identity, "findById").mockResolvedValue(userInstance);

        const req = { user: mockUser };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await logoutAllDevices(req, res);

        expect(saveMock).toHaveBeenCalled();
        expect(userInstance.tokenVersion).toBe(3);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                message: "Logged out from all devices successfully."
            })
        );
    });

    test("11. deleteAccount: Requires exact DELETE confirmation and correct password", async () => {
        // Bad confirmation text
        const req1 = {
            user: mockUser,
            body: { confirmationText: "NO", password: "Password123!" }
        };
        const res1 = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        await deleteAccount(req1, res1);
        expect(res1.status).toHaveBeenCalledWith(400);

        // Good confirmation & password -> sets status DELETED and cleans up data
        const saveMock = jest.fn().mockResolvedValue(true);
        const userInstance = { ...mockUser, save: saveMock };
        jest.spyOn(Identity, "findById").mockResolvedValue(userInstance);
        jest.spyOn(bcrypt, "compare").mockResolvedValue(true);
        const profileDeleteSpy = jest.spyOn(Profile, "deleteMany").mockResolvedValue({ deletedCount: 1 });
        const postUpdateSpy = jest.spyOn(Post, "updateMany").mockResolvedValue({ modifiedCount: 3 });
        const commentUpdateSpy = jest.spyOn(Comment, "updateMany").mockResolvedValue({ modifiedCount: 2 });
        const likeDeleteSpy = jest.spyOn(Like, "deleteMany").mockResolvedValue({ deletedCount: 5 });
        const communityUpdateSpy = jest.spyOn(Community, "updateMany").mockResolvedValue({ modifiedCount: 1 });
        const followDeleteSpy = jest.spyOn(Follow, "deleteMany").mockResolvedValue({ deletedCount: 0 });
        const blockDeleteSpy = jest.spyOn(Block, "deleteMany").mockResolvedValue({ deletedCount: 0 });
        const notificationDeleteSpy = jest.spyOn(Notification, "deleteMany").mockResolvedValue({ deletedCount: 0 });

        const req2 = {
            user: mockUser,
            body: { confirmationText: "DELETE", password: "Password123!" }
        };
        const res2 = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await deleteAccount(req2, res2);

        expect(userInstance.status).toBe("DELETED");
        expect(profileDeleteSpy).toHaveBeenCalledWith({ userId: mockUserId });
        expect(postUpdateSpy).toHaveBeenCalledWith({ author: mockUserId }, { isDeleted: true });
        expect(commentUpdateSpy).toHaveBeenCalledWith({ author: mockUserId }, { isDeleted: true });
        expect(likeDeleteSpy).toHaveBeenCalledWith({ user: mockUserId });
        expect(communityUpdateSpy).toHaveBeenCalledTimes(2);
        expect(followDeleteSpy).toHaveBeenCalledWith({
            $or: [{ follower: mockUserId }, { following: mockUserId }]
        });
        expect(blockDeleteSpy).toHaveBeenCalledWith({
            $or: [{ blocker: mockUserId }, { blocked: mockUserId }]
        });
        expect(notificationDeleteSpy).toHaveBeenCalledWith({
            $or: [{ recipient: mockUserId }, { sender: mockUserId }]
        });
        expect(res2.status).toHaveBeenCalledWith(200);
        expect(res2.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                message: expect.stringContaining("deleted")
            })
        );
    });

    test("12. authMiddleware: Invalidation check rejects tokens with mismatched tokenVersion", async () => {
        process.env.JWT_SECRET = "jwt_secret_for_tests";
        const staleToken = jwt.sign(
            { userId: mockUserId.toString(), tokenVersion: 0 },
            process.env.JWT_SECRET
        );

        // User in DB has bumped tokenVersion = 1
        jest.spyOn(Identity, "findById").mockResolvedValue({
            ...mockUser,
            tokenVersion: 1
        });

        const req = {
            headers: {
                authorization: `Bearer ${staleToken}`
            }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        await protect(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                message: "Session has been invalidated. Please log in again."
            })
        );
        expect(next).not.toHaveBeenCalled();
    });
});
