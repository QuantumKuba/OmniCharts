/**
 * Utility for converting timeframe strings to milliseconds
 * @param {string|number} tf - Timeframe string (e.g., "1m", "5m", "1h") or milliseconds
 * @returns {number} - Timeframe in milliseconds
 */
export function tfToMs(tf) {
    // If tf is already a number (milliseconds), return it directly
    if (typeof tf === 'number') {
        return tf;
    }
    
    // Ensure tf is a string
    tf = String(tf);
    
    // Map of timeframe units to milliseconds
    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000,
        M: 30 * 24 * 60 * 60 * 1000
    };

    try {
        // Extract the numeric part and the unit
        const num = parseInt(tf);
        const unit = tf.slice(-1); // Get the last character as the unit
        
        if (isNaN(num) || !multipliers[unit]) {
            console.warn(`[TimeframeUtils] Invalid timeframe format: ${tf}, defaulting to 5m`);
            return 5 * 60 * 1000; // Default to 5 minutes
        }
        
        return num * multipliers[unit];
    } catch (e) {
        console.error(`[TimeframeUtils] Error parsing timeframe: ${tf}`, e);
        return 5 * 60 * 1000; // Default to 5 minutes on error
    }
}

/**
 * Convert timeframe from milliseconds back to string format
 * @param {number|string} ms - Milliseconds or timeframe string
 * @returns {string} - Timeframe string (e.g., "5m", "1h")
 */
export function msToTf(ms) {
    // If it's already a string that looks like a timeframe, return it
    if (typeof ms === 'string') {
        // Check if it matches the pattern of a number followed by a timeframe unit
        if (/^[0-9]+[smhdwM]$/.test(ms)) {
            return ms;
        }
        
        // Try to extract a valid timeframe from the string
        const match = ms.match(/([0-9]+)([smhdwM])/);
        if (match) {
            return match[1] + match[2];
        }
    }
    
    // Try to convert to number if it's a string but not in timeframe format
    if (typeof ms === 'string') {
        ms = parseInt(ms);
    }
    
    if (typeof ms !== 'number' || isNaN(ms)) {
        console.warn(`[TimeframeUtils] Invalid millisecond value: ${ms}, defaulting to 5m`);
        return "5m"; // Default
    }
    
    // Handle common timeframes
    switch(ms) {
        case 60000: return "1m";
        case 180000: return "3m";
        case 300000: return "5m";
        case 540000: return "9m";
        case 900000: return "15m";
        case 1620000: return "27m";
        case 1800000: return "30m";
        case 3600000: return "1h";
        case 7200000: return "2h";
        case 10800000: return "3h";
        case 14400000: return "4h";
        case 21600000: return "6h";
        case 28800000: return "8h";
        case 43200000: return "12h";
        case 86400000: return "1d";
        case 259200000: return "3d";
        case 604800000: return "1w";
        case 2592000000: return "1M";
        default:
            // Best-effort conversion to appropriate unit
            if (ms < 3600000) { // Less than an hour
                return Math.round(ms / 60000) + "m";
            } else if (ms < 86400000) { // Less than a day
                return Math.round(ms / 3600000) + "h";
            } else if (ms < 604800000) { // Less than a week
                return Math.round(ms / 86400000) + "d";
            } else if (ms < 2592000000) { // Less than a month
                return Math.round(ms / 604800000) + "w";
            } else {
                return Math.round(ms / 2592000000) + "M";
            }
    }
}

/**
 * Check if a timeframe is valid and supported
 * @param {string|number} tf - Timeframe to check
 * @returns {boolean} - True if valid
 */
export function isValidTimeframe(tf) {
    // If it's a number, assume it's milliseconds and check common values
    if (typeof tf === 'number') {
        const commonTfMs = [
            60000, 180000, 300000, 540000, 900000, 1620000, 1800000, // minutes
            3600000, 7200000, 10800000, 14400000, 21600000, 28800000, 43200000, // hours
            86400000, 259200000, 604800000, 2592000000 // days+
        ];
        return commonTfMs.includes(tf);
    }
    
    // If it's a string, check format and common values
    if (typeof tf === 'string') {
        // Check format
        if (!/^[0-9]+[smhdwM]$/.test(tf)) {
            return false;
        }
        
        // Common timeframes
        const commonTfs = ['1m', '3m', '5m', '9m', '15m', '27m', '30m', 
                         '1h', '2h', '3h', '4h', '6h', '8h', '12h', 
                         '1d', '3d', '1w', '1M'];
        
        return commonTfs.includes(tf);
    }
    
    return false;
}