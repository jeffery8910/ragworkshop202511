// Simple in-memory rate limiter. 
// Note: In serverless (Vercel), this map is reset frequently. 
// For production, use Redis (Vercel KV).

const usageMap = new Map<string, number[]>();
const WINDOW_MS = 60 * 1000; // 1 minute
const LIMIT = 10; // 10 requests per minute

export function checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const timestamps = usageMap.get(userId) || [];

    // Filter out old timestamps
    const validTimestamps = timestamps.filter(t => now - t < WINDOW_MS);

    if (validTimestamps.length >= LIMIT) {
        return false; // Rate limited
    }

    validTimestamps.push(now);
    usageMap.set(userId, validTimestamps);
    return true;
}
