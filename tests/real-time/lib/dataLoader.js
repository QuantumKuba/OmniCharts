import { tfToMs, msToTf } from './timeframeUtils.js';
const API_INTERVALS = ['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','3d','1w','1M'];

class DataLoader {
    constructor(symbol = 'BTCUSDT', timeframe = '5m') {
        // Use Vite dev proxy to hit Binance REST without CORS
        this.URL = "/api/v3/klines";
        this.SYM = symbol;
        this._tf = timeframe; // Direct assignment to avoid circular reference
        this.loading = false;
        this.lastRequestTime = 0; // Track last request time for throttling
        this.MIN_REQUEST_INTERVAL = 500; // Minimum ms between requests
        this.MAX_CANDLES_PER_REQUEST = 1000; // Binance API limit
        this.DEFAULT_BATCH_SIZE = 50; // Default candles to fetch if we can't calculate
        this.SCROLL_THRESHOLD_FACTOR = 0.25; // How close to edge before loading more (0.25 = 25% of visible range)
        this.loadingQueue = []; // Queue pending load requests
        
        // Cache system to avoid refetching data
        this.dataCache = {
            // Map of timestamps to cached data
            // Key: timestamp, Value: array of candle data
            byTimestamp: new Map(),
            
            // Track the oldest timestamp we've fetched for this symbol/timeframe
            oldestTimestamp: Infinity,
            
            // Track the newest timestamp we've fetched for this symbol/timeframe
            newestTimestamp: -Infinity,
            
            // Used to identify when we need to reset the cache (symbol or timeframe change)
            symbol: symbol,
            timeframe: timeframe,
            
            // Pre-fetch settings
            PREFETCH_MULTIPLIER: 2, // How much additional data to prefetch (2x = twice the current view)
        };
    }

    // Ensure TF setter handles both string and millisecond formats
    set TF(value) {
        if (typeof value === 'number') {
            // Convert from milliseconds to string format if needed
            // const { msToTf } = require('./timeframeUtils.js'); // Removed require
            this._tf = msToTf(value); // Uses imported msToTf
            console.log(`DataLoader: converted timeframe from ${value}ms to ${this._tf}`);
            
            // Reset cache when timeframe changes
            if (this.dataCache.timeframe !== this._tf) {
                this.resetCache();
            }
        } else {
            // Reset cache when timeframe changes
            if (this.dataCache.timeframe !== value) {
                this._tf = value;
                this.resetCache();
            } else {
                this._tf = value;
            }
        }
    }
    
    get TF() {
        return this._tf;
    }
    
    // Reset the data cache when symbol or timeframe changes
    resetCache() {
        console.log(`[DataLoader] Resetting cache for symbol: ${this.SYM}, timeframe: ${this._tf}`);
        this.dataCache = {
            byTimestamp: new Map(),
            oldestTimestamp: Infinity,
            newestTimestamp: -Infinity,
            symbol: this.SYM,
            timeframe: this._tf,
            PREFETCH_MULTIPLIER: this.dataCache.PREFETCH_MULTIPLIER || 2
        };
    }
    
    // Add fetched data to cache
    addToCache(candles) {
        if (!candles || candles.length === 0) return;
        
        // Different symbol or timeframe - reset cache
        if (this.dataCache.symbol !== this.SYM || this.dataCache.timeframe !== this._tf) {
            this.resetCache();
        }
        
        let updated = false;
        
        // Add each candle to cache by timestamp
        for (const candle of candles) {
            const timestamp = candle[0];
            
            // Only add if we don't already have this timestamp
            if (!this.dataCache.byTimestamp.has(timestamp)) {
                this.dataCache.byTimestamp.set(timestamp, candle);
                updated = true;
                
                // Update oldest and newest timestamps
                if (timestamp < this.dataCache.oldestTimestamp) {
                    this.dataCache.oldestTimestamp = timestamp;
                }
                
                if (timestamp > this.dataCache.newestTimestamp) {
                    this.dataCache.newestTimestamp = timestamp;
                }
            }
        }
        
        if (updated) {
            console.log(`[DataLoader] Cache updated: ${this.dataCache.byTimestamp.size} candles cached, range: ${new Date(this.dataCache.oldestTimestamp).toISOString()} to ${new Date(this.dataCache.newestTimestamp).toISOString()}`);
        }
    }
    
    // Check if we already have data for a given timestamp range
    hasDataInCache(startTime, endTime) {
        // If cache is for a different symbol or timeframe, return false
        if (this.dataCache.symbol !== this.SYM || this.dataCache.timeframe !== this._tf) {
            return false;
        }
        
        return startTime >= this.dataCache.oldestTimestamp && endTime <= this.dataCache.newestTimestamp;
    }
    
    // Get data from cache for a timestamp range
    getFromCache(startTime, endTime) {
        // If cache is for a different symbol or timeframe, return empty array
        if (this.dataCache.symbol !== this.SYM || this.dataCache.timeframe !== this._tf) {
            return [];
        }
        
        // Filter the cached candles within the specified range
        const candles = [];
        for (const [timestamp, candle] of this.dataCache.byTimestamp.entries()) {
            if (timestamp >= startTime && timestamp <= endTime) {
                candles.push(candle);
            }
        }
        
        // Sort by timestamp
        candles.sort((a, b) => a[0] - b[0]);
        
        console.log(`[DataLoader] Retrieved ${candles.length} candles from cache for range: ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);
        return candles;
    }

    // Calculate optimal batch size based on chart range and scroll position
    calculateOptimalBatchSize(visibleRange, oldestTime) {
        try {
            // If we don't have a valid range yet, use default
            if (!visibleRange || !Array.isArray(visibleRange) || visibleRange.length < 2 || visibleRange[1] <= visibleRange[0]) {
                return this.DEFAULT_BATCH_SIZE;
            }
            
            // Calculate the width of the current view in time units
            const visibleTimespan = visibleRange[1] - visibleRange[0];
            
            // Calculate how far back we're scrolling (distance from visible range to oldest loaded candle)
            const scrollDistance = visibleRange[0] - oldestTime; // Can be negative if scrolling left (older data)
            
            // How far we are scrolling as a percentage of visible range
            const scrollFactor = Math.abs(scrollDistance) / visibleTimespan;
            
            let batchSize;
            const maxEffectiveBatch = this.MAX_CANDLES_PER_REQUEST; // Max target candles we aim for

            if (scrollFactor <= this.SCROLL_THRESHOLD_FACTOR) {
                batchSize = this.DEFAULT_BATCH_SIZE;
            } else {
                let dynamicFactor;
                // Scale from SCROLL_THRESHOLD_FACTOR up to 1.0 (one full screen width scrolled)
                if (scrollFactor <= 1.0) {
                    // Linearly scale dynamicFactor from 0 to 0.5 as scrollFactor goes from THRESHOLD to 1.0
                    dynamicFactor = ((scrollFactor - this.SCROLL_THRESHOLD_FACTOR) / (1.0 - this.SCROLL_THRESHOLD_FACTOR)) * 0.5;
                } else {
                    // For scrolls larger than one screen width (scrollFactor > 1.0)
                    // Linearly scale dynamicFactor from 0.5 to 1.0 as scrollFactor goes from 1.0 to 3.0 (e.g.)
                    dynamicFactor = 0.5 + Math.min((scrollFactor - 1.0) / 2.0, 1.0) * 0.5; // Cap second part at 0.5
                }
                dynamicFactor = Math.max(0, Math.min(dynamicFactor, 1.0)); // Ensure 0 <= dynamicFactor <= 1

                batchSize = Math.round(
                    this.DEFAULT_BATCH_SIZE +
                    (maxEffectiveBatch - this.DEFAULT_BATCH_SIZE) * dynamicFactor
                );
            }
            
            // The `if (!scrollDistance)` prefetch logic was removed here,
            // as prefetching is handled by the `isPrefetch` flag in `executeLoadMore`
            // and the `preloadHistoricalData` method.

            // Ensure batchSize for target candles is capped (e.g., by MAX_CANDLES_PER_REQUEST,
            // interpreting it as a sensible upper limit for target candles too).
            batchSize = Math.min(batchSize, this.MAX_CANDLES_PER_REQUEST);
            batchSize = Math.max(batchSize, this.DEFAULT_BATCH_SIZE); // Ensure it's at least default
            
            console.log(`[DataLoader] Calculated batch size (target candles): ${batchSize}, scroll factor: ${scrollFactor.toFixed(2)}`);
            return batchSize;
            
        } catch (e) {
            console.error('[DataLoader] Error calculating batch size:', e);
            return this.DEFAULT_BATCH_SIZE;
        }
    }

    async load(callback) {
        // Attempt fetching bars from the largest API-supported interval down to 1m
        const rawBars = 50 * this.dataCache.PREFETCH_MULTIPLIER; // Prefetch more data initially
        const targetMs = tfToMs(this.TF);
        
        // Log clear details about what we're trying to load
        console.log(`[DataLoader] Loading ${this.SYM} with TF=${this.TF} (${targetMs}ms)`);
        
        // Build list of APIIntervals that evenly divide target timeframe
        const candidates = API_INTERVALS
            .map(i => ({ interval: i, ms: tfToMs(i) }))
            .filter(o => o.ms <= targetMs && targetMs % o.ms === 0)
            .sort((a, b) => b.ms - a.ms);
            
        // Always try 1m as last fallback
        candidates.push({ interval: '1m', ms: tfToMs('1m') });
        
        console.log(`[DataLoader] Using candidate intervals: ${candidates.map(c => c.interval).join(', ')}`);

        let raw;
        for (let { interval, ms: baseMs } of candidates) {
            // Calculate minimal limit, but do not exceed Binance's cap
            let limit = Math.ceil(rawBars * (targetMs / baseMs));
            limit = Math.min(limit, 1000);
            const url = `${this.URL}?symbol=${this.SYM}&interval=${interval}&limit=${limit}`;
            console.log(`[DataLoader] Trying ${interval} for TF=${this.TF}, limit=${limit}`);
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                if (!json || json.length === 0) throw new Error('Empty payload');
                raw = json;
                console.log(`[DataLoader] Success via ${interval}, received ${raw.length} raw bars`);
                
                // Found a usable raw dataset
                // Aggregate if needed
                const formatted = raw.map(x => this.format(x));
                
                // For higher timeframes, ensure we have enough data
                const data = baseMs === targetMs
                    ? formatted
                    : this.aggregate(formatted, baseMs, targetMs);
                    
                const finalData = data;
                
                console.log(`[DataLoader] FinalData for ${this.SYM}, TF=${this.TF}: ` +
                    `length=${finalData.length}, ` +
                    `start=${new Date(finalData[0][0]).toISOString()}, ` +
                    `end=${new Date(finalData[finalData.length-1][0]).toISOString()}, ` +
                    `using interval=${interval}`);
                
                // For higher timeframes, ensure data has volume and proper structure
                this.validateData(finalData);
                
                // Add data to cache
                this.addToCache(finalData);
                
                // Callback with full panes and tools definitions
                callback({
                    panes: [
                        {
                            scripts: [
                                { name: "BB", type: "BB", data: finalData, props: { length: 21, stddev: 2, color: "#2cc6c9ab" } },
                                // { name: "TrippleEMA", type: "TrippleEMA" ,
                                //     props : {
                                //         length1: 9, color1: "#FF0000",
                                //         length2: 21, color2: "#00FF00",
                                //         length3: 60, color3: "#0000FF",
                                //     }
                                // },
                                {name: "ZLEMA", type: "ZLEMA" , data: finalData }
                            ],
                            overlays: [
                                { 
                                    name: `${this.SYM} / Tether US`, 
                                    type: "Candles", 
                                    main: true, 
                                    data: finalData, 
                                    props: {}, 
                                    settings: { 
                                        zIndex: 100, 
                                        symbol: this.SYM,
                                        timeFrame: this.TF
                                    } 
                                },         
                                // {
                                //     name: "ArrowTrades – Sell Test",
                                //     type: "ArrowTrades",
                                //       data: [
                                //             // 1) Sell at the latest candle
                                //             [ finalData[finalData.length - 1][0], [-1, "SELL_NOW", true] ],
                                //             // 2) Sell 10 minutes before the latest candle
                                //             [ finalData[finalData.length - 1][0] - 10 * 60 * 1000, [-1, "SELL_PAST", false] ]
                                //            ],
                                //     props: {
                                //       sellColor: "#e42633",
                                //       buyColor: "#08c65e",
                                //       size: 10,
                                //       showLabels: true,
                                //       markerOutline: true,
                                //       outlineWidth: 2
                                //     },
                                //     settings: {
                                //       zIndex: 200
                                //     }
                                // },
                                
                                { name: "RangeTool", type: "RangeTool", drawingTool: true, data: [], props: {}, settings: { zIndex: 1000 } },
                                { name: "LineTool", type: "LineTool", drawingTool: true, data: [], props: {}, settings: { zIndex: 1000 } },
                                { name: "LineToolHorizontalRay", type: "LineToolHorizontalRay", drawingTool: true, data: [], props: {}, settings: { zIndex: 1000 } },
                                { name: "Brush", type: "Brush", drawingTool: true }
                            ],
                        },
                        {
                            scripts: [ { type: "MACD" } ],
                            overlays: [
                                { name: "RangeTool", type: "RangeTool", drawingTool: true, data: [], props: {}, settings: { zIndex: 1000 } },
                                { name: "LineTool", type: "LineTool", drawingTool: true, data: [], props: {}, settings: { zIndex: 1000 } },
                                { name: "LineToolHorizontalRay", type: "LineToolHorizontalRay", drawingTool: true, data: [], props: {}, settings: { zIndex: 1000 } },
                                { name: "Brush", type: "Brush", drawingTool: true }
                            ]
                        },
                        {
                            scripts: [ { type: "Stoch" } ],
                            overlays: [
                                { name: "RangeTool", type: "RangeTool", drawingTool: true, data: [], props: {}, settings: { zIndex: 1000 } },
                                { name: "LineTool", type: "LineTool", drawingTool: true, data: [], props: {}, settings: { zIndex: 1000 } },
                                { name: "LineToolHorizontalRay", type: "LineToolHorizontalRay", drawingTool: true, data: [], props: {}, settings: { zIndex: 1000 } },
                                { name: "Brush", type: "Brush", drawingTool: true }
                            ]
                        }
                    ],
                    tools: [
                        {
                            type: "Cursor",
                            icon: `<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M480-400q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm-40-240v-200h80v200h-80Zm0 520v-200h80v200h-80Zm200-320v-80h200v80H640Zm-520 0v-80h200v80H120Z"/></svg>`,
                        },
                        {
                            type: "Brush",
                            label: "Brush",
                            icon: `
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="24px" height="24px" viewBox="0 -2 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    
    <title>brush</title>
       <defs>

</defs>
    <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" sketch:type="MSPage">
        <g id="Icon-Set" sketch:type="MSLayerGroup" transform="translate(-99.000000, -154.000000)" fill="currentColor">
            <path d="M128.735,157.585 L116.047,170.112 L114.65,168.733 L127.339,156.206 C127.725,155.825 128.35,155.825 128.735,156.206 C129.121,156.587 129.121,157.204 128.735,157.585 L128.735,157.585 Z M112.556,173.56 C112.427,173.433 111.159,172.181 111.159,172.181 L113.254,170.112 L114.65,171.491 L112.556,173.56 L112.556,173.56 Z M110.461,178.385 C109.477,179.298 105.08,181.333 102.491,179.36 C102.491,179.36 103.392,178.657 104.074,177.246 C105.703,172.919 109.763,173.56 109.763,173.56 L111.159,174.938 C111.173,174.952 112.202,176.771 110.461,178.385 L110.461,178.385 Z M130.132,154.827 C128.975,153.685 127.099,153.685 125.942,154.827 L108.764,171.788 C106.661,171.74 103.748,172.485 102.491,176.603 C101.53,178.781 99,178.671 99,178.671 C104.253,184.498 110.444,181.196 111.857,179.764 C113.1,178.506 113.279,176.966 113.146,175.734 L130.132,158.964 C131.289,157.821 131.289,155.969 130.132,154.827 L130.132,154.827 Z" id="brush" sketch:type="MSShapeGroup">

</path>
        </g>
    </g>
</svg>`
                        },
                        {
                            type: "LineTool",
                            label: "Line",
                            icon: `
<?xml version="1.0" encoding="utf-8"?><!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools -->
<svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M18 5C17.4477 5 17 5.44772 17 6C17 6.27642 17.1108 6.52505 17.2929 6.70711C17.475 6.88917 17.7236 7 18 7C18.5523 7 19 6.55228 19 6C19 5.44772 18.5523 5 18 5ZM15 6C15 4.34315 16.3431 3 18 3C19.6569 3 21 4.34315 21 6C21 7.65685 19.6569 9 18 9C17.5372 9 17.0984 8.8948 16.7068 8.70744L8.70744 16.7068C8.8948 17.0984 9 17.5372 9 18C9 19.6569 7.65685 21 6 21C4.34315 21 3 19.6569 3 18C3 16.3431 4.34315 15 6 15C6.46278 15 6.90157 15.1052 7.29323 15.2926L15.2926 7.29323C15.1052 6.90157 15 6.46278 15 6ZM6 17C5.44772 17 5 17.4477 5 18C5 18.5523 5.44772 19 6 19C6.55228 19 7 18.5523 7 18C7 17.7236 6.88917 17.475 6.70711 17.2929C6.52505 17.1108 6.27642 17 6 17Z" fill="currentColor"/>
</svg>`
                        },
                        {
                            type: "LineToolHorizontalRay",
                            label: "Horizontal Ray (Right Click)",
                            icon: `<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M180-380q-42 0-71-29t-29-71q0-42 29-71t71-29q31 0 56 17t36 43h608v80H272q-11 26-36 43t-56 17Z"/></svg>`
                        },
                        {
                            type: "RangeTool",
                            label: "Measure",
                            icon: `
<?xml version="1.0" encoding="utf-8"?><!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools -->
<svg version="1.1" id="Uploaded to svgrepo.com" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
	 width="24px" height="24px" viewBox="0 0 32 32" xml:space="preserve">
<style type="text/css">
	.linesandangles_een{fill:currentColor;}
</style>
<path class="linesandangles_een" d="M21,1.586L2.586,20L12,29.414L30.414,11L21,1.586z M5.414,20L21,4.414L27.586,11L26.5,12.086
	l-1.793-1.793l-1.414,1.414l1.793,1.793L23.5,15.086l-3.793-3.793l-1.414,1.414l3.793,3.793L20.5,18.086l-1.793-1.793l-1.414,1.414
	l1.793,1.793L17.5,21.086l-1.793-1.793l-1.414,1.414l1.793,1.793L14.5,24.086l-3.793-3.793l-1.414,1.414l3.793,3.793L12,26.586
	L5.414,20z"/>
</svg>`
                        },
                        {
                            type: "Magnet",
                            label: "Magnet",
                            icon: `
<?xml version="1.0" encoding="utf-8"?><!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools -->
<svg width="24px" height="24px" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><title>ionicons-v5-o</title><path d="M421.83,293.82A144,144,0,0,0,218.18,90.17" style="fill:none;stroke:currentColor;stroke-miterlimit:10;stroke-width:32px"/><path d="M353.94,225.94a48,48,0,0,0-67.88-67.88" style="fill:none;stroke:currentColor;stroke-miterlimit:10;stroke-width:32px"/><line x1="192" y1="464" x2="192" y2="416" style="stroke:currentColor;stroke-linecap:round;stroke-miterlimit:10;stroke-width:32px"/><line x1="90.18" y1="421.82" x2="124.12" y2="387.88" style="stroke:currentColor;stroke-linecap:round;stroke-miterlimit:10;stroke-width:32px"/><line x1="48" y1="320" x2="96" y2="320" style="stroke:currentColor;stroke-linecap:round;stroke-miterlimit:10;stroke-width:32px"/><path d="M286.06,158.06,172.92,271.19a32,32,0,0,1-45.25,0L105,248.57a32,32,0,0,1,0-45.26L218.18,90.17" style="fill:none;stroke:currentColor;stroke-linejoin:round;stroke-width:32px"/><path d="M421.83,293.82,308.69,407a32,32,0,0,1-45.26,0l-22.62-22.63a32,32,0,0,1,0-45.26L353.94,225.94" style="fill:none;stroke:currentColor;stroke-linejoin:round;stroke-width:32px"/><line x1="139.6" y1="169.98" x2="207.48" y2="237.87" style="fill:none;stroke:currentColor;stroke-linejoin:round;stroke-width:32px"/><line x1="275.36" y1="305.75" x2="343.25" y2="373.63" style="fill:none;stroke:currentColor;stroke-linejoin:round;stroke-width:32px"/></svg>`
                        },
                        {
                            type: "Trash",
                            icon: `
<?xml version="1.0" encoding="utf-8"?><!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools -->
<svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M18 6L17.1991 18.0129C17.129 19.065 17.0939 19.5911 16.8667 19.99C16.6666 20.3412 16.3648 20.6235 16.0011 20.7998C15.588 21 15.0607 21 14.0062 21H9.99377C8.93927 21 8.41202 21 7.99889 20.7998C7.63517 20.6235 7.33339 20.3412 7.13332 19.99C6.90607 19.5911 6.871 19.065 6.80086 18.0129L6 6M4 6H20M16 6L15.7294 5.18807C15.4671 4.40125 15.3359 4.00784 15.0927 3.71698C14.8779 3.46013 14.6021 3.26132 14.2905 3.13878C13.9376 3 13.523 3 12.6936 3H11.3064C10.477 3 10.0624 3 9.70951 3.13878C9.39792 3.26132 9.12208 3.46013 8.90729 3.71698C8.66405 4.00784 8.53292 4.40125 8.27064 5.18807L8 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`
                        }
                    ]
                });
                
                // Preload additional historical data after initial load
                this.preloadHistoricalData(finalData[0][0]);
                
                return;
            } catch (e) {
                console.warn(`[DataLoader] Failed with interval ${interval}:`, e);
                // try next candidate
            }
        }
        console.error(`[DataLoader] All intervals failed for TF=${this.TF}`);
    }
    
    // Preload historical data in the background
    async preloadHistoricalData(fromTimestamp) {
        // Don't preload if already loading
        if (this.loading) return;
        
        // Give a small delay to not interfere with initial load
        setTimeout(() => {
            console.log(`[DataLoader] Preloading historical data from ${new Date(fromTimestamp).toISOString()}`);
            
            // Use our loadMore function but with a special flag
            this.loadMore(fromTimestamp - 1, (chunk) => {
                if (chunk && chunk.length) {
                    console.log(`[DataLoader] Preloaded ${chunk.length} historical candles`);
                    // We don't need to do anything with the data, it's in cache now
                }
            }, null, true);
        }, 1000);
    }

    // Validate data for rendering
    validateData(data) {
        if (!data || data.length === 0) return;
        
        // Check for any 0 values that might prevent rendering
        for (let i = 0; i < data.length; i++) {
            const candle = data[i];
            
            // Validate timestamp
            if (!candle[0]) {
                console.warn(`[DataLoader] Fixing invalid timestamp at index ${i}`);
                // If timestamp is 0, estimate based on previous/next candles
                if (i > 0 && i < data.length - 1) {
                    candle[0] = data[i-1][0] + (data[i+1][0] - data[i-1][0])/2;
                } else if (i > 0) {
                    candle[0] = data[i-1][0] + tfToMs(this.TF);
                } else if (i < data.length - 1) {
                    candle[0] = data[i+1][0] - tfToMs(this.TF);
                }
            }
            
            // Ensure OHLCV values are non-zero
            for (let j = 1; j <= 5; j++) {
                if (candle[j] === 0 || candle[j] === undefined || candle[j] === null) {
                    // Try to infer a reasonable value
                    if (i > 0) {
                        candle[j] = data[i-1][j];
                        console.warn(`[DataLoader] Fixing 0 value at [${i}][${j}] with previous candle value`);
                    } else if (i < data.length - 1) {
                        candle[j] = data[i+1][j];
                        console.warn(`[DataLoader] Fixing 0 value at [${i}][${j}] with next candle value`);
                    } else {
                        // Last resort - use a small non-zero value
                        candle[j] = 0.00001;
                        console.warn(`[DataLoader] Using fallback value for [${i}][${j}]`);
                    }
                }
            }
        }
    }

    // Process request queue to avoid spamming the API
    processQueue() {
        if (this.loadingQueue.length > 0 && !this.loading) {
            const next = this.loadingQueue.shift();
            this.executeLoadMore(next.endTime, next.callback, next.chartRange, next.isPrefetch);
        }
    }
    
    // Throttled load request - queues new requests if we're already loading
    async loadMore(endTime, callback, chartRange = null, isPrefetch = false) {
        // Check cache first if this isn't a prefetch
        if (!isPrefetch) {
            // Calculate the time range we're looking for
            const targetMs = tfToMs(this.TF);
            const batchSize = this.calculateOptimalBatchSize(chartRange, endTime);
            const startTime = endTime - (batchSize * targetMs);
            
            // If we already have this data in cache, use it
            if (this.hasDataInCache(startTime, endTime)) {
                console.log(`[DataLoader] Using cached data for range ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);
                const cachedData = this.getFromCache(startTime, endTime);
                if (cachedData.length > 0) {
                    callback(cachedData);
                    return;
                }
            }
        }
        
        // Don't queue duplicate requests for the same timestamp
        if (this.loadingQueue.some(request => request.endTime === endTime)) {
            console.log(`[DataLoader] Duplicate request for ${new Date(endTime).toISOString()} - ignoring`);
            return;
        }
        
        // Add to queue and process
        this.loadingQueue.push({ endTime, callback, chartRange, isPrefetch });
        this.processQueue();
        
        // Start a timer to process the queue if nothing happens
        if (this.loadingQueue.length > 0 && !this.queueTimer) {
            this.queueTimer = setTimeout(() => {
                this.queueTimer = null;
                this.processQueue();
            }, this.MIN_REQUEST_INTERVAL);
        }
    }

    // Actual implementation of loadMore
    async executeLoadMore(endTime, callback, chartRange, isPrefetch = false) {
        if (this.loading) {
            // This request will be queued by the caller (loadMore) if this.loading is true.
            // If processQueue calls this while loading, it's a bug in queue logic.
            // For safety, if called directly when loading, just return.
            return;
        }
        
        const now = Date.now();
        if (now - this.lastRequestTime < this.MIN_REQUEST_INTERVAL) {
            const waitTime = this.MIN_REQUEST_INTERVAL - (now - this.lastRequestTime);
            console.log(`[DataLoader] Rate limiting - waiting ${waitTime}ms before next request`);
            setTimeout(() => this.executeLoadMore(endTime, callback, chartRange, isPrefetch), waitTime);
            return;
        }
        
        this.loading = true;
        this.lastRequestTime = now; // Mark time for the first potential fetch
        
        const targetMs = tfToMs(this.TF);
        let desiredTargetCandles = this.DEFAULT_BATCH_SIZE;
        if (chartRange) {
            desiredTargetCandles = this.calculateOptimalBatchSize(chartRange, endTime);
        }
        
        if (isPrefetch) {
            desiredTargetCandles = Math.min(
                Math.round(desiredTargetCandles * this.dataCache.PREFETCH_MULTIPLIER),
                this.MAX_CANDLES_PER_REQUEST // Cap target prefetch count
            );
        }
        // Ensure desiredTargetCandles is at least 1 if we are to fetch.
        desiredTargetCandles = Math.max(desiredTargetCandles, 1);

        console.log(`[DataLoader] executeLoadMore: Aiming for ${desiredTargetCandles} target candles for TF=${this.TF}. EndTime: ${new Date(endTime).toISOString()}, isPrefetch: ${isPrefetch}`);
        
        const baseApiIntervals = API_INTERVALS
            .map(i => ({ interval: i, ms: tfToMs(i) }))
            .filter(o => o.ms <= targetMs && targetMs % o.ms === 0)
            .sort((a, b) => b.ms - a.ms);
        const allCandidateIntervals = baseApiIntervals.concat([{ interval: '1m', ms: tfToMs('1m') }]);

        let finalAggregatedChunk = [];
        let overallSuccess = false;

        for (let { interval: baseInterval, ms: baseMs } of allCandidateIntervals) {
            const aggregationRatio = targetMs / baseMs;
            let collectedRawCandlesForThisBase = [];
            let currentRequestEndTimeForLoop = endTime;
            const MAX_INTERNAL_FETCH_LOOPS = 5; // Safety cap for internal loops
            let internalFetchCount = 0;

            const estimatedTotalRawNeeded = Math.ceil(desiredTargetCandles * aggregationRatio);
            
            console.log(`[DataLoader] Trying baseInterval: ${baseInterval} (ratio: ${aggregationRatio}). Estimated raw needed: ${estimatedTotalRawNeeded} for ${desiredTargetCandles} target.`);

            while (internalFetchCount < MAX_INTERNAL_FETCH_LOOPS) {
                internalFetchCount++;

                const remainingRawToCollect = estimatedTotalRawNeeded - collectedRawCandlesForThisBase.length;
                
                if (desiredTargetCandles > 0 && remainingRawToCollect <= 0 && collectedRawCandlesForThisBase.length > 0) {
                    // Already collected enough raw candles for the desired target count
                    break;
                }

                let rawLimitForThisAPICall = Math.min(this.MAX_CANDLES_PER_REQUEST, remainingRawToCollect > 0 ? remainingRawToCollect : this.MAX_CANDLES_PER_REQUEST);
                rawLimitForThisAPICall = Math.max(rawLimitForThisAPICall, 1); // Ensure fetching at least 1 raw candle

                const url = `${this.URL}?symbol=${this.SYM}&interval=${baseInterval}&endTime=${currentRequestEndTimeForLoop}&limit=${rawLimitForThisAPICall}`;
                console.log(`[DataLoader] Internal fetch (${internalFetchCount}/${MAX_INTERNAL_FETCH_LOOPS}): ${baseInterval}, end: ${new Date(currentRequestEndTimeForLoop).toISOString()}, limit: ${rawLimitForThisAPICall}`);

                try {
                    // If this is not the very first fetch of this executeLoadMore call
                    if (internalFetchCount > 1 || this.lastRequestTime !== now) { // `now` is the timestamp before the first fetch
                         // Check if we need to wait due to MIN_REQUEST_INTERVAL from previous fetch
                        const timeSinceLast = Date.now() - this.lastRequestTime;
                        if (timeSinceLast < this.MIN_REQUEST_INTERVAL) {
                            const internalWaitTime = this.MIN_REQUEST_INTERVAL - timeSinceLast;
                            console.log(`[DataLoader] Internal loop rate limiting - waiting ${internalWaitTime}ms`);
                            await new Promise(resolve => setTimeout(resolve, internalWaitTime));
                        }
                    }
                    
                    this.lastRequestTime = Date.now(); // Update time before this fetch
                    const result = await fetch(url);
                    if (!result.ok) throw new Error(`HTTP ${result.status} from ${url}`);
                    const rawBatch = await result.json();

                    if (!rawBatch || rawBatch.length === 0) {
                        console.log(`[DataLoader] No data from ${baseInterval} ending ${new Date(currentRequestEndTimeForLoop).toISOString()}`);
                        break; // Break internal loop for this baseInterval, try next baseInterval or finish
                    }

                    const formattedBatch = rawBatch.map(x => this.format(x));
                    collectedRawCandlesForThisBase.unshift(...formattedBatch); // Prepend to keep sorted by time

                    // Update for next potential internal loop
                    currentRequestEndTimeForLoop = formattedBatch[0][0]; 

                    if (formattedBatch.length < rawLimitForThisAPICall || currentRequestEndTimeForLoop <= 0) {
                        console.log(`[DataLoader] Fetched all available data or hit start for ${baseInterval}.`);
                        break; // Reached the beginning of history for this interval
                    }
                    if (desiredTargetCandles > 0 && (collectedRawCandlesForThisBase.length >= estimatedTotalRawNeeded)) {
                        break; // Collected enough raw data for the desired target candles
                    }
                } catch (e) {
                    console.warn(`[DataLoader] Internal fetch for ${baseInterval} failed:`, e);
                    break; // Break internal loop, try next baseInterval
                }
            } // End of while (internalFetchCount)

            if (collectedRawCandlesForThisBase.length > 0) {
                collectedRawCandlesForThisBase.sort((a, b) => a[0] - b[0]); // Ensure correct order before aggregation

                const aggregated = (baseMs === targetMs || aggregationRatio === 1)
                    ? collectedRawCandlesForThisBase
                    : this.aggregate(collectedRawCandlesForThisBase, baseMs, targetMs);

                if (aggregated.length > 0) {
                    // If we over-fetched target candles due to raw data granularity, take the most recent ones.
                    finalAggregatedChunk = (aggregated.length > desiredTargetCandles && desiredTargetCandles > 0)
                        ? aggregated.slice(-desiredTargetCandles)
                        : aggregated;

                    console.log(`[DataLoader] Success via ${baseInterval}. Produced ${finalAggregatedChunk.length} target candles for TF=${this.TF}. Oldest: ${new Date(finalAggregatedChunk[0][0]).toISOString()}`);
                    this.validateData(finalAggregatedChunk);
                    this.addToCache(finalAggregatedChunk);
                    overallSuccess = true;
                    break; // Break from looping through baseCandidateIntervals
                }
            }
        } // End of for (allCandidateIntervals)

        if (overallSuccess && finalAggregatedChunk.length > 0) {
            callback(finalAggregatedChunk);
        } else {
            console.log(`[DataLoader] Failed to load sufficient data or no data found for TF=${this.TF} ending ${new Date(endTime).toISOString()}`);
            callback([]); // Send empty array on failure or if no data
        }

        this.loading = false;
        setTimeout(() => this.processQueue(), 0); // Process queue for any pending requests
    }

    format(x) {
        return [
            x[0], // timestamp
            parseFloat(x[1]), // open
            parseFloat(x[2]), // high
            parseFloat(x[3]), // low
            parseFloat(x[4]), // close
            parseFloat(x[7])  // volume
        ];
    }

    /**
     * Aggregate candles from a base timeframe to a custom target timeframe
     */
    aggregate(candles, baseMs, targetMs) {
        const result = [];
        if (candles.length === 0) return result;

        let currentGroup = null;
        for (const c of candles) {
            const t = c[0];
            const groupStart = Math.floor(t / targetMs) * targetMs;
            if (!currentGroup || currentGroup.time !== groupStart) {
                if (currentGroup) {
                    result.push([currentGroup.time, currentGroup.open, currentGroup.high, currentGroup.low, currentGroup.close, currentGroup.volume]);
                }
                currentGroup = { time: groupStart, open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5] };
            } else {
                currentGroup.high = Math.max(currentGroup.high, c[2]);
                currentGroup.low = Math.min(currentGroup.low, c[3]);
                currentGroup.close = c[4];
                currentGroup.volume += c[5];
            }
        }
        // push last group
        if (currentGroup) {
            result.push([currentGroup.time, currentGroup.open, currentGroup.high, currentGroup.low, currentGroup.close, currentGroup.volume]);
        }
        return result;
    }
}

export { DataLoader };
