const { GoogleGenAI } = require("@google/genai");
const { aiToolRegistry } = require("./aiToolRegistry");

/**
 * System prompt establishing ANOY AI assistant role, platform context, and boundaries.
 */
const SYSTEM_PROMPT = `You are ANOY AI, the helpful, intelligent, and friendly student assistant for the ANOY university social platform.

Your primary missions are:
1. Guide students on using ANOY features accurately (Communities, Meeting Rooms, Profiles, Posts, Direct Messages, ANOY Pro).
2. Help students discover public communities, public student profiles, and public discussions.
3. Answer student academic, technical, and general questions (e.g., programming concepts, data structures, study tips, course concepts) clearly and concisely.

Strict Privacy & Security Rules:
- You DO NOT have access to private direct messages, passwords, or emails.
- You must ONLY reference the platform data provided in the context.
- Never invent features that do not exist on ANOY.
- Format answers with clean Markdown (bullet points, bold highlights, code blocks).
- Be supportive, concise, and student-friendly.`;

/**
 * Sanitizes input and output text to ensure sensitive secrets are never leaked.
 */
const sanitizeContent = (text = "") => {
    if (typeof text !== "string") return "";
    return text
        .replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, "[REDACTED_TOKEN]")
        .replace(/rzp_(test|live)_[A-Za-z0-9]+/gi, "[REDACTED_KEY]")
        .replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, "[REDACTED_DB_URI]");
};

/**
 * Determines whether an error is a permanent client/auth/config error that must NOT be retried.
 */
const isPermanentError = (error) => {
    if (!error) return false;
    const status = error.status || error.statusCode || error.code;
    const msg = (error.message || "").toLowerCase();

    // Known HTTP/gRPC permanent client status codes
    if (status === 400 || status === 401 || status === 403 || status === 404) return true;
    if (status === "400" || status === "401" || status === "403" || status === "404") return true;

    // Known error message keywords indicating permanent failure
    if (
        msg.includes("invalid_argument") ||
        msg.includes("unauthenticated") ||
        msg.includes("permission_denied") ||
        msg.includes("not_found") ||
        msg.includes("invalid api key") ||
        msg.includes("api_key_invalid") ||
        msg.includes("api key not valid") ||
        msg.includes("not configured") ||
        msg.includes("malformed")
    ) {
        return true;
    }

    return false;
};

/**
 * Determines whether an error is a transient failure eligible for exponential backoff retry.
 */
const isTransientError = (error) => {
    if (!error) return false;
    if (isPermanentError(error)) return false;

    const status = error.status || error.statusCode || error.code;
    const msg = (error.message || "").toLowerCase();

    // Known HTTP/gRPC transient status codes
    if ([429, 500, 502, 503, 504].includes(Number(status))) return true;
    if (["429", "500", "502", "503", "504"].includes(String(status))) return true;

    // Known transient message keywords (high demand, unavailable, rate limits, network timeouts)
    if (
        msg.includes("503") ||
        msg.includes("unavailable") ||
        msg.includes("high demand") ||
        msg.includes("spikes in demand") ||
        msg.includes("overloaded") ||
        msg.includes("temporarily") ||
        msg.includes("try again later") ||
        msg.includes("429") ||
        msg.includes("resource_exhausted") ||
        msg.includes("rate limit") ||
        msg.includes("quota") ||
        msg.includes("500") ||
        msg.includes("502") ||
        msg.includes("504") ||
        msg.includes("deadline_exceeded") ||
        msg.includes("econnreset") ||
        msg.includes("etimedout") ||
        msg.includes("fetch failed") ||
        msg.includes("socket hang up") ||
        msg.includes("network error") ||
        msg.includes("eai_again")
    ) {
        return true;
    }

    return false;
};

/**
 * Helper to get configured or default retry backoff delays in milliseconds.
 */
const getRetryDelays = () => {
    if (process.env.AI_RETRY_DELAYS_MS) {
        return process.env.AI_RETRY_DELAYS_MS.split(",").map((v) => Number(v.trim())).filter((n) => !isNaN(n));
    }
    return [1000, 2000, 4000];
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calls Gemini with exponential backoff for transient errors (up to 3 retries).
 */
const callGeminiWithRetry = async ({
    ai,
    modelName,
    fullPrompt,
    maxRetries = 3,
    delays = getRetryDelays()
}) => {
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: fullPrompt
            });

            const replyText = response.text ? response.text.trim() : "";
            if (!replyText) {
                throw new Error("Gemini returned an empty response");
            }

            return replyText;
        } catch (error) {
            lastError = error;

            // Fail fast on permanent authentication / argument / configuration errors
            if (isPermanentError(error)) {
                const safeMsg = sanitizeContent(error.message || "Permanent error occurred");
                throw new Error(`ANOY AI Error: ${safeMsg}`);
            }

            // Retry on transient error if attempts remaining
            if (attempt < maxRetries && isTransientError(error)) {
                const delay = delays[attempt] !== undefined ? delays[attempt] : 1000 * Math.pow(2, attempt);
                console.warn(
                    `Gemini API transient failure (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}. Retrying in ${delay}ms...`
                );
                await sleep(delay);
                continue;
            }

            // Otherwise, break out of loop
            break;
        }
    }

    // If final failure was transient (e.g. repeated 503 UNAVAILABLE / 429 RESOURCE_EXHAUSTED)
    if (isTransientError(lastError)) {
        throw new Error("ANOY AI is temporarily busy. Please try again in a moment.");
    }

    const safeError = sanitizeContent(lastError?.message || "Unknown error occurred");
    throw new Error(`ANOY AI Error: ${safeError}`);
};

/**
 * Executes relevant tool queries based on message content and returns contextual payload.
 */
const executeContextTools = async (message, currentUserId) => {
    const text = message.toLowerCase();
    const sources = [];
    const contextParts = [];

    // 1. ANOY Platform Feature Guidance
    if (
        text.includes("how to") ||
        text.includes("how do i") ||
        text.includes("what is anoy") ||
        text.includes("anoy pro") ||
        text.includes("meeting room") ||
        text.includes("study room") ||
        text.includes("community") ||
        text.includes("follow") ||
        text.includes("create") ||
        text.includes("upgrade")
    ) {
        const helpData = await aiToolRegistry.getAnoyHelp(text);
        contextParts.push(`[ANOY Feature Guide - ${helpData.category}]:\n${helpData.content}`);
        sources.push({ type: "help", title: `ANOY Guide: ${helpData.category}` });
    }

    // 2. Student / People Discovery
    if (
        (text.includes("find") || text.includes("search") || text.includes("show") || text.includes("who")) &&
        (text.includes("student") || text.includes("people") || text.includes("user") || text.includes("someone") || text.includes("mention") || text.includes("knows"))
    ) {
        const queryTerm = message.replace(/(find|search|show|students|people|users|who|knows|mention|mentioning|with|for)/gi, "").trim();
        const users = await aiToolRegistry.searchPublicUsers(queryTerm || message, 4);
        if (users.length > 0) {
            const userSummary = users
                .map((u) => `- @${u.username} (${u.displayName}): Bio: "${u.bio || 'None'}", Skills: [${u.skills.join(', ')}]`)
                .join("\n");
            contextParts.push(`[Public Students Found on ANOY]:\n${userSummary}`);
            users.forEach((u) => sources.push({ type: "user", title: `@${u.username}`, id: u.username }));
        }
    }

    // 3. Community Discovery
    if (
        (text.includes("find") || text.includes("search") || text.includes("show") || text.includes("list")) &&
        (text.includes("communit") || text.includes("hub") || text.includes("club") || text.includes("group"))
    ) {
        const queryTerm = message.replace(/(find|search|show|list|communities|community|hubs|clubs|groups|about|for)/gi, "").trim();
        const comms = await aiToolRegistry.searchPublicCommunities(queryTerm || message, currentUserId, 4);
        if (comms.length > 0) {
            const commSummary = comms
                .map((c) => `- ${c.name} (slug: ${c.slug}): "${c.description}", Members: ${c.memberCount}, Visibility: ${c.isPrivate ? "Private (Member)" : "Public"}`)
                .join("\n");
            contextParts.push(`[Public / Authorized Communities on ANOY]:\n${commSummary}`);
            comms.forEach((c) => sources.push({ type: "community", title: c.name, id: c.slug }));
        }
    }

    // 4. Post Discovery
    if (
        (text.includes("find") || text.includes("search") || text.includes("show")) &&
        (text.includes("post") || text.includes("feed") || text.includes("discussion") || text.includes("topic"))
    ) {
        const queryTerm = message.replace(/(find|search|show|posts|post|discussions|feed|about|for)/gi, "").trim();
        const posts = await aiToolRegistry.searchPublicPosts(queryTerm || message, 3);
        if (posts.length > 0) {
            const postSummary = posts
                .map((p) => `- Post by @${p.author}: "${p.content}"`)
                .join("\n");
            contextParts.push(`[Public Posts Found on ANOY]:\n${postSummary}`);
            posts.forEach((p) => sources.push({ type: "post", title: `Post by @${p.author}`, id: p.id }));
        }
    }

    return {
        contextString: contextParts.join("\n\n"),
        sources
    };
};

/**
 * Generate AI Assistant Response using configured provider (Gemini / OpenAI / Mock).
 */
const generateAssistantResponse = async ({
    message,
    conversationHistory = [],
    currentUserId,
    retryDelays = getRetryDelays(),
    maxRetries = 3
}) => {
    const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase().trim();

    // Execute controlled backend authorization tools
    const { contextString, sources } = await executeContextTools(message, currentUserId);

    // Build bounded conversation prompt
    const recentTurns = conversationHistory
        .slice(-6)
        .map((m) => `${m.role === "user" ? "Student" : "ANOY AI"}: ${m.content}`)
        .join("\n");

    const fullPrompt = [
        SYSTEM_PROMPT,
        contextString ? `--- PLATFORM DATA & AUTHORIZED CONTEXT ---\n${contextString}\n---` : "",
        recentTurns ? `--- RECENT CHAT HISTORY ---\n${recentTurns}\n---` : "",
        `Student: ${message}`,
        `ANOY AI:`
    ]
        .filter(Boolean)
        .join("\n\n");

    // 1. Google Gemini Provider
    if (provider === "gemini") {
        const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
        if (!apiKey) {
            throw new Error(
                "Gemini API key is not configured. Please set GEMINI_API_KEY in server/.env to enable ANOY AI."
            );
        }

        const modelName = process.env.AI_MODEL || "gemini-3.8-flash";
        const ai = new GoogleGenAI({ apiKey });

        const replyText = await callGeminiWithRetry({
            ai,
            modelName,
            fullPrompt,
            maxRetries,
            delays: retryDelays
        });

        return {
            content: sanitizeContent(replyText),
            sources
        };
    }

    // 2. Explicit Mock Mode (used in automated unit tests)
    if (provider === "mock") {
        let synthesizedReply = "";
        const lower = message.toLowerCase();

        if (contextString.includes("[ANOY Feature Guide")) {
            synthesizedReply = `Here is how that works on **ANOY**:\n\n${contextString.replace(/\[ANOY Feature Guide - [^\]]+\]:\n/, "")}\n\nFeel free to ask if you'd like more details on any of these features! 🚀`;
        } else if (contextString.includes("[Public Students Found")) {
            synthesizedReply = `Here are public students matching your search on ANOY:\n\n${contextString.replace("[Public Students Found on ANOY]:\n", "")}\n\nYou can view their profiles by searching their handle in the Search tab!`;
        } else if (contextString.includes("[Public / Authorized Communities")) {
            synthesizedReply = `Here are communities on ANOY matching your search:\n\n${contextString.replace("[Public / Authorized Communities on ANOY]:\n", "")}\n\nHead over to the **Communities** tab to explore and join them!`;
        } else if (contextString.includes("[Public Posts Found")) {
            synthesizedReply = `Here are recent public posts matching your query:\n\n${contextString.replace("[Public Posts Found on ANOY]:\n", "")}`;
        } else if (lower.includes("binary search")) {
            synthesizedReply = `**Binary Search** is an efficient \(O(\\log n)\) algorithm for finding an item in a sorted list by repeatedly dividing the search interval in half.\n\n\`\`\`javascript\nfunction binarySearch(arr, target) {\n  let left = 0, right = arr.length - 1;\n  while (left <= right) {\n    const mid = Math.floor((left + right) / 2);\n    if (arr[mid] === target) return mid;\n    if (arr[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}\n\`\`\``;
        } else if (lower.includes("tcp")) {
            synthesizedReply = `**TCP (Transmission Control Protocol)** is a connection-oriented transport protocol that ensures reliable, ordered, and error-checked delivery of byte streams between applications.\n\nKey features:\n- **3-Way Handshake** (SYN, SYN-ACK, ACK)\n- **Flow & Congestion Control**\n- **Guaranteed packet ordering**`;
        } else if (lower.includes("mongodb index")) {
            synthesizedReply = `**MongoDB Indexing** uses B-Trees to drastically improve query performance from \(O(n)\) collection scans to \(O(\\log n)\) index scans.\n\nExample compound index:\n\`\`\`javascript\npostSchema.index({ author: 1, createdAt: -1 });\n\`\`\``;
        } else {
            synthesizedReply = `Mock response for: "${message}". Set AI_PROVIDER=gemini and GEMINI_API_KEY in server/.env to use real Gemini AI.`;
        }

        return {
            content: sanitizeContent(synthesizedReply),
            sources
        };
    }

    // 3. Fallback for Unsupported Provider
    throw new Error(`Unsupported AI_PROVIDER '${provider}'. Valid providers are 'gemini' or 'mock'.`);
};

module.exports = {
    generateAssistantResponse,
    sanitizeContent,
    executeContextTools,
    isPermanentError,
    isTransientError,
    callGeminiWithRetry,
    getRetryDelays
};
