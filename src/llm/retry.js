/**
 * Sleep helper utility
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Determine if an error is retriable
 */
function isRetriableError(error) {
    if (!error) return false;

    const status = error.status || error.statusCode || (error.response && error.response.status);

    // Explicit Non-Retriable Client Errors: 400, 401, 403, 404, 422
    if (status === 400 || status === 401 || status === 403 || status === 404 || status === 422) {
        return false;
    }

    // Retriable Server / Rate limit Errors: 429, 500, 502, 503, 504, 529
    if (status === 429 || (status >= 500 && status <= 599)) {
        return true;
    }

    // Network timeouts or connection drops
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.name === 'APIConnectionTimeoutError') {
        return true;
    }

    return false;
}

/**
 * Extract delay from Retry-After header if present
 */
function getRetryAfterDelay(error) {
    const headers = error.headers || (error.response && error.response.headers);
    if (!headers) return null;

    const retryAfter = headers['retry-after'] || headers['Retry-After'];
    if (!retryAfter) return null;

    // If integer in seconds
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
        return seconds * 1000;
    }

    // If HTTP date format
    const parsedDate = Date.parse(retryAfter);
    if (!isNaN(parsedDate)) {
        const diff = parsedDate - Date.now();
        return diff > 0 ? diff : 1000;
    }

    return null;
}

/**
 * Execute an asynchronous operation with exponential backoff and jitter
 */
async function executeWithRetry(fn, maxRetries = 2) {
    let attempt = 0;

    while (true) {
        try {
            return await fn(attempt);
        } catch (error) {
            attempt++;

            if (attempt > maxRetries || !isRetriableError(error)) {
                throw error;
            }

            const headerDelay = getRetryAfterDelay(error);
            let delay;

            if (headerDelay !== null) {
                delay = headerDelay;
            } else {
                // Exponential backoff base: 1000ms * 2^(attempt - 1)
                const baseDelay = 1000 * Math.pow(2, attempt - 1);
                const jitter = Math.floor(Math.random() * (baseDelay * 0.25));
                delay = baseDelay + jitter;
            }

            console.warn(`[RetryPolicy] Retrying call (attempt ${attempt}/${maxRetries}) after ${delay}ms delay. Reason: ${error.message || error.status}`);
            await sleep(delay);
        }
    }
}

module.exports = {
    isRetriableError,
    executeWithRetry
};
