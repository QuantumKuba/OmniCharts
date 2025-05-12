/**
 * Symbol Service - Fetches and manages symbols from the exchange
 * Provides searchable access to trading pairs with categorization
 */

// Symbol cache with expiration time to prevent excessive API calls
let symbolCache = {
    data: null,
    timestamp: 0,
    expiresAfterMs: 1000 * 60 * 60, // Cache for 1 hour
    categories: {}
};

// Favorites management
let favorites = [];

/**
 * Load favorites from cookies
 */
function loadFavorites() {
    try {
        const cookieValue = getCookie('omni_favorites');
        if (cookieValue) {
            favorites = JSON.parse(cookieValue);
            console.log(`[SymbolService] Loaded ${favorites.length} favorites from cookies`);
        }
    } catch (error) {
        console.error('[SymbolService] Error loading favorites from cookies:', error);
        favorites = [];
    }
    return favorites;
}

/**
 * Save favorites to cookies
 */
function saveFavorites() {
    try {
        setCookie('omni_favorites', JSON.stringify(favorites), 365); // Store for 1 year
        console.log(`[SymbolService] Saved ${favorites.length} favorites to cookies`);
    } catch (error) {
        console.error('[SymbolService] Error saving favorites to cookies:', error);
    }
}

/**
 * Add a symbol to favorites
 * @param {string} symbol - Symbol to add to favorites
 */
function addFavorite(symbol) {
    if (!favorites.includes(symbol)) {
        favorites.push(symbol);
        saveFavorites();
    }
}

/**
 * Remove a symbol from favorites
 * @param {string} symbol - Symbol to remove from favorites
 */
function removeFavorite(symbol) {
    const index = favorites.indexOf(symbol);
    if (index !== -1) {
        favorites.splice(index, 1);
        saveFavorites();
    }
}

/**
 * Check if a symbol is in favorites
 * @param {string} symbol - Symbol to check
 * @returns {boolean} True if the symbol is a favorite
 */
function isFavorite(symbol) {
    return favorites.includes(symbol);
}

/**
 * Get all favorite symbols with full info
 * @returns {Promise<Array>} Array of favorite symbol objects
 */
async function getFavorites() {
    // Ensure we have symbols data
    const allSymbols = await fetchAllSymbols();
    
    // Match favorite symbols with full data
    return favorites
        .map(favSymbol => 
            allSymbols.find(s => s.symbol === favSymbol)
        )
        .filter(s => s !== undefined); // Filter out any that weren't found
}

/**
 * Toggle a symbol's favorite status
 * @param {string} symbol - Symbol to toggle
 * @returns {boolean} New favorite status
 */
function toggleFavorite(symbol) {
    if (isFavorite(symbol)) {
        removeFavorite(symbol);
        return false;
    } else {
        addFavorite(symbol);
        return true;
    }
}

/**
 * Helper function to get cookie value
 * @param {string} name - Cookie name
 * @returns {string|null} Cookie value or null if not found
 */
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        return parts.pop().split(';').shift();
    }
    return null;
}

/**
 * Helper function to set cookie value
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {number} days - Number of days until expiration
 */
function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax`;
}

/**
 * Fetch all available trading symbols from Binance
 * @returns {Promise<Array>} Array of symbol objects
 */
async function fetchAllSymbols() {
    try {
        // Check if we have a valid cached response
        const now = Date.now();
        if (
            symbolCache.data &&
            now - symbolCache.timestamp < symbolCache.expiresAfterMs
        ) {
            console.log('Using cached symbols data');
            return symbolCache.data;
        }

        console.log('Fetching symbols from Binance API...');
        
        // Using the exchange info endpoint to get full symbol information
        const response = await fetch('/api/v3/exchangeInfo');
        
        if (!response.ok) {
            throw new Error(`Failed to fetch symbols: ${response.status}`);
        }
        
        const data = await response.json();
        const symbols = data.symbols
            .filter(s => s.status === 'TRADING') // Only get active trading pairs
            .map(s => ({
                symbol: s.symbol,
                baseAsset: s.baseAsset,
                quoteAsset: s.quoteAsset,
                pricePrecision: s.pricePrecision,
                quantityPrecision: s.quantityPrecision,
                status: s.status
            }));
        
        // Update cache
        symbolCache.data = symbols;
        symbolCache.timestamp = now;
        
        // Process symbols into categories
        processSymbolCategories(symbols);
        
        console.log(`Fetched ${symbols.length} symbols from API`);
        return symbols;
    } catch (error) {
        console.error('Error fetching symbols:', error);
        
        // Fallback to default list if API request fails
        return getFallbackSymbols();
    }
}

/**
 * Process symbols into categories for easier browsing
 * @param {Array} symbols - Array of symbol objects
 */
function processSymbolCategories(symbols) {
    // Group by quote asset (e.g., USDT, BTC, ETH, etc.)
    const categories = {};
    
    symbols.forEach(s => {
        if (!categories[s.quoteAsset]) {
            categories[s.quoteAsset] = [];
        }
        categories[s.quoteAsset].push(s);
    });
    
    // Sort categories by popularity (USDT, BTC, ETH first)
    const sortOrder = ['USDT', 'BUSD', 'BTC', 'ETH', 'BNB'];
    
    // Sort the symbols within each category by volume/popularity
    Object.keys(categories).forEach(key => {
        // Alphabetical sort for base assets within each category
        categories[key].sort((a, b) => a.baseAsset.localeCompare(b.baseAsset));
    });
    
    symbolCache.categories = categories;
    return categories;
}

/**
 * Search for symbols by query string
 * @param {string} query - Search query
 * @returns {Array} Filtered symbols matching the query
 */
async function searchSymbols(query) {
    // Ensure we have symbols data
    const symbols = await fetchAllSymbols();
    
    if (!query || query.trim() === '') {
        return symbols;
    }
    
    // Normalize query for case-insensitive search
    const normalizedQuery = query.trim().toUpperCase();
    
    return symbols.filter(s => 
        s.symbol.includes(normalizedQuery) || 
        s.baseAsset.includes(normalizedQuery) || 
        s.quoteAsset.includes(normalizedQuery)
    );
}

/**
 * Get symbols by category (quote asset)
 * @param {string} category - Quote asset category like USDT, BTC, etc.
 * @returns {Promise<Array>} Symbols in the specified category
 */
async function getSymbolsByCategory(category) {
    // Ensure we have symbols data and categories
    await fetchAllSymbols();
    
    if (!category || !symbolCache.categories[category]) {
        // Return top categories if no specific category requested
        return getTopSymbols();
    }
    
    return symbolCache.categories[category];
}

/**
 * Get available categories (quote assets)
 * @returns {Promise<Array>} Array of category names
 */
async function getCategories() {
    // Ensure we have symbols data
    await fetchAllSymbols();
    
    // Sort categories by popularity
    const sortOrder = ['USDT', 'BUSD', 'BTC', 'ETH', 'BNB'];
    
    return Object.keys(symbolCache.categories).sort((a, b) => {
        const indexA = sortOrder.indexOf(a);
        const indexB = sortOrder.indexOf(b);
        
        // If both are in sortOrder, use that order
        if (indexA >= 0 && indexB >= 0) {
            return indexA - indexB;
        }
        
        // If only one is in sortOrder, prefer that one
        if (indexA >= 0) return -1;
        if (indexB >= 0) return 1;
        
        // Otherwise, alphabetical
        return a.localeCompare(b);
    });
}

/**
 * Get top/popular symbols across categories
 * @param {number} limit - Maximum number of symbols to return
 * @returns {Promise<Array>} Array of popular symbols
 */
async function getTopSymbols(limit = 20) {
    // Ensure we have symbols data
    await fetchAllSymbols();
    
    // Our predefined list of popular symbols
    const popularBaseAssets = [
        'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'SHIB',
        'AVAX', 'DOT', 'LINK', 'MATIC', 'LTC', 'UNI', 'ATOM'
    ];
    
    // Prefer USDT pairs for these popular assets
    const result = [];
    
    if (symbolCache.categories.USDT) {
        popularBaseAssets.forEach(baseAsset => {
            const symbol = symbolCache.categories.USDT.find(
                s => s.baseAsset === baseAsset
            );
            if (symbol) {
                result.push(symbol);
            }
        });
    }
    
    // If we don't have enough, add some from other categories
    if (result.length < limit && symbolCache.categories.BTC) {
        popularBaseAssets.forEach(baseAsset => {
            if (result.length >= limit) return;
            
            const symbol = symbolCache.categories.BTC.find(
                s => s.baseAsset === baseAsset && !result.includes(s)
            );
            if (symbol) {
                result.push(symbol);
            }
        });
    }
    
    return result.slice(0, limit);
}

/**
 * Fallback symbol list in case API calls fail
 * @returns {Array} Default list of common trading pairs
 */
function getFallbackSymbols() {
    // If API fails, return a default set of common symbols
    const symbols = [
        'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 
        'DOGEUSDT', 'SOLUSDT', 'MATICUSDT', 'LTCUSDT', 'UNIUSDT',
        'DOTUSDT', 'AVAXUSDT', 'ATOMUSDT', 'LINKUSDT', 'SHIBUSDT',
        'ETCUSDT', 'VETUSDT', 'SANDUSDT', 'WAVESUSDT', 'ONEUSDT'
    ].map(symbol => {
        // Extract base and quote assets from symbol string
        const quoteAssets = ['USDT', 'BTC', 'ETH', 'BNB', 'BUSD'];
        let baseAsset = symbol;
        let quoteAsset = 'USDT'; // Default
        
        // Find which quote asset this symbol uses
        for (const qa of quoteAssets) {
            if (symbol.endsWith(qa)) {
                quoteAsset = qa;
                baseAsset = symbol.substring(0, symbol.length - qa.length);
                break;
            }
        }
        
        return {
            symbol,
            baseAsset,
            quoteAsset,
            pricePrecision: 8,
            quantityPrecision: 8,
            status: 'TRADING'
        };
    });
    
    // Process these into categories as well
    processSymbolCategories(symbols);
    
    return symbols;
}

export default {
    fetchAllSymbols,
    searchSymbols,
    getSymbolsByCategory,
    getCategories,
    getTopSymbols,
    // Favorites management
    loadFavorites,
    saveFavorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    getFavorites,
    toggleFavorite
};