/**
 * Utility for converting timeframe strings to milliseconds
 * @param {string} tf - Timeframe string (e.g., "1m", "5m", "1h")
 * @returns {number} - Timeframe in milliseconds
 */
export function tfToMs(tf) {
    const unit = tf.slice(-1);
    const value = parseInt(tf.slice(0, -1));
    
    switch (unit) {
        case 's': // seconds
            return value * 1000;
        case 'm': // minutes
            return value * 60 * 1000;
        case 'h': // hours
            return value * 60 * 60 * 1000;
        case 'd': // days
            return value * 24 * 60 * 60 * 1000;
        case 'w': // weeks
            return value * 7 * 24 * 60 * 60 * 1000;
        case 'M': // months (approximated)
            return value * 30 * 24 * 60 * 60 * 1000;
        default:
            console.warn(`Unknown timeframe unit: ${unit}, defaulting to 5 minutes`);
            return 5 * 60 * 1000; // Default to 5 minutes
    }
}