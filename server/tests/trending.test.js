const { getTrendingTopics } = require("../controllers/postController");
const Post = require("../models/Post");
const Like = require("../models/Like");
const Comment = require("../models/Comment");

describe("ANOY Real Dynamic Trending Topics Unit & Integration Test Suite", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("1. Empty State: Returns count 0 and empty trending array when no public posts exist", async () => {
        jest.spyOn(Post, "find").mockReturnValue({
            select: jest.fn().mockReturnValue({
                sort: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue([])
                })
            })
        });

        const req = { query: { limit: 5 } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await getTrendingTopics(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            count: 0,
            trending: []
        });
    });

    test("2. Empty State: Returns count 0 when public posts exist but contain no hashtags", async () => {
        const mockPosts = [
            { _id: "post1", content: "Just sharing my thoughts on campus today.", createdAt: new Date() },
            { _id: "post2", content: "Great lecture in computer science!", createdAt: new Date() }
        ];

        jest.spyOn(Post, "find").mockReturnValue({
            select: jest.fn().mockReturnValue({
                sort: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue(mockPosts)
                })
            })
        });

        const req = { query: {} };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await getTrendingTopics(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            count: 0,
            trending: []
        });
    });

    test("3. Real Public Topics: Calculates trending hashtags from public posts with accurate counts & engagement", async () => {
        const now = new Date();
        const mockPosts = [
            { _id: "p1", content: "Building projects at #Chitkara with #React!", createdAt: now },
            { _id: "p2", content: "Sharing our team demo for #Chitkara hackathon.", createdAt: now },
            { _id: "p3", content: "Excited about #AI innovations across Bharat.", createdAt: now }
        ];

        jest.spyOn(Post, "find").mockReturnValue({
            select: jest.fn().mockReturnValue({
                sort: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue(mockPosts)
                })
            })
        });

        // Mock likes: 2 likes on p1, 1 like on p2
        jest.spyOn(Like, "find").mockReturnValue({
            select: jest.fn().mockResolvedValue([
                { post: "p1" },
                { post: "p1" },
                { post: "p2" }
            ])
        });

        // Mock comments: 1 comment on p1
        jest.spyOn(Comment, "find").mockReturnValue({
            select: jest.fn().mockResolvedValue([
                { post: "p1" }
            ])
        });

        const req = { query: { limit: 5 } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await getTrendingTopics(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const data = res.json.mock.calls[0][0];
        expect(data.success).toBe(true);
        expect(data.count).toBe(3);

        const chitkaraTrend = data.trending.find((t) => t.tag.toLowerCase() === "#chitkara");
        expect(chitkaraTrend).toBeDefined();
        expect(chitkaraTrend.postCount).toBe(2);
        expect(chitkaraTrend.likeCount).toBe(3); // 2 on p1 + 1 on p2
        expect(chitkaraTrend.commentCount).toBe(1); // 1 on p1
        expect(chitkaraTrend.engagement).toBe(4);

        const reactTrend = data.trending.find((t) => t.tag.toLowerCase() === "#react");
        expect(reactTrend).toBeDefined();
        expect(reactTrend.postCount).toBe(1);

        const aiTrend = data.trending.find((t) => t.tag.toLowerCase() === "#ai");
        expect(aiTrend).toBeDefined();
        expect(aiTrend.postCount).toBe(1);
    });

    test("4. Privacy Verification: Query strictly enforces isDeleted: false and visibility: 'PUBLIC'", async () => {
        let capturedQuery = null;
        jest.spyOn(Post, "find").mockImplementation((query) => {
            capturedQuery = query;
            return {
                select: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([])
                    })
                })
            };
        });

        const req = { query: {} };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await getTrendingTopics(req, res);

        expect(capturedQuery).toBeDefined();
        expect(capturedQuery.isDeleted).toBe(false);
        expect(capturedQuery.visibility).toBe("PUBLIC");
    });

    test("5. Ranking Order: Higher engagement and recent post counts rank at the top", async () => {
        const now = new Date();
        const mockPosts = [
            { _id: "postA", content: "Single mention #QuietTrend", createdAt: now },
            { _id: "postB1", content: "Viral discussion on #MegaTrend", createdAt: now },
            { _id: "postB2", content: "More updates for #MegaTrend", createdAt: now }
        ];

        jest.spyOn(Post, "find").mockReturnValue({
            select: jest.fn().mockReturnValue({
                sort: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue(mockPosts)
                })
            })
        });

        jest.spyOn(Like, "find").mockReturnValue({
            select: jest.fn().mockResolvedValue([
                { post: "postB1" },
                { post: "postB1" },
                { post: "postB2" }
            ])
        });

        jest.spyOn(Comment, "find").mockReturnValue({
            select: jest.fn().mockResolvedValue([
                { post: "postB1" }
            ])
        });

        const req = { query: { limit: 5 } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await getTrendingTopics(req, res);

        const data = res.json.mock.calls[0][0];
        expect(data.trending[0].tag.toLowerCase()).toBe("#megatrend");
        expect(data.trending[1].tag.toLowerCase()).toBe("#quiettrend");
        expect(data.trending[0].score).toBeGreaterThan(data.trending[1].score);
    });

    test("6. Limit enforcement: Respects the limit parameter correctly", async () => {
        const now = new Date();
        const mockPosts = [
            { _id: "p1", content: "#Tag1 #Tag2 #Tag3 #Tag4 #Tag5 #Tag6 #Tag7", createdAt: now }
        ];

        jest.spyOn(Post, "find").mockReturnValue({
            select: jest.fn().mockReturnValue({
                sort: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue(mockPosts)
                })
            })
        });

        jest.spyOn(Like, "find").mockReturnValue({
            select: jest.fn().mockResolvedValue([])
        });

        jest.spyOn(Comment, "find").mockReturnValue({
            select: jest.fn().mockResolvedValue([])
        });

        const req = { query: { limit: 3 } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await getTrendingTopics(req, res);

        const data = res.json.mock.calls[0][0];
        expect(data.trending.length).toBe(3);
    });
});
