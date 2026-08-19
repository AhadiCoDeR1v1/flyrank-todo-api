const crypto = require('crypto');

// In-memory LRU-style cache
const cache = new Map();
const MAX_CACHE_SIZE = 500;

/**
 * Generate unique cache key from input text and prompt version
 */
function getCacheKey(text, promptVersion) {
    return crypto.createHash('sha256')
        .update(`${promptVersion}::${text.trim().toLowerCase()}`)
        .digest('hex');
}

/**
 * Retrieve cached response if present
 */
function getCached(text, promptVersion) {
    const key = getCacheKey(text, promptVersion);
    if (cache.has(key)) {
        return cache.get(key);
    }
    return null;
}

/**
 * Store response in cache with size bounding
 */
function setCache(text, promptVersion, response) {
    if (cache.size >= MAX_CACHE_SIZE) {
        // Evict oldest entry
        const oldestKey = cache.keys().next().value;
        cache.delete(oldestKey);
    }
    const key = getCacheKey(text, promptVersion);
    cache.set(key, response);
}

/**
 * Clear the cache
 */
function clearCache() {
    cache.clear();
}

module.exports = {
    getCached,
    setCache,
    clearCache
};
