import { tfToMs } from './timeframeUtils.js';
const API_INTERVALS = ['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','3d','1w','1M'];

class DataLoader {
    constructor(symbol = 'BTCUSDT', timeframe = '5m') {
        // Use Vite dev proxy to hit Binance REST without CORS
        this.URL = "/api/v3/klines";
        this.SYM = symbol;
        this._tf = timeframe; // Direct assignment to avoid circular reference
        this.loading = false;
    }

    // Ensure TF setter handles both string and millisecond formats
    set TF(value) {
        if (typeof value === 'number') {
            // Convert from milliseconds to string format if needed
            const { msToTf } = require('./timeframeUtils.js');
            this._tf = msToTf(value);
            console.log(`DataLoader: converted timeframe from ${value}ms to ${this._tf}`);
        } else {
            this._tf = value;
        }
    }
    
    get TF() {
        return this._tf;
    }

    async load(callback) {
        // Attempt fetching bars from the largest API-supported interval down to 1m
        const rawBars = 50;
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
                
                // Callback with full panes and tools definitions
                callback({
                    panes: [
                        {
                            scripts: [
                                { name: "BB", type: "BB", data: finalData, props: { length: 21, stddev: 2, color: "#2cc6c9ab" } },
                                { name: "TrippleEMA", type: "TrippleEMA" }
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
                        { type: "Cursor", icon: `🖱️` },
                        { type: "Brush", label: "Brush", icon: `🖌` },
                        { type: "LineTool", label: "Line", icon: `—` },
                        { type: "LineToolHorizontalRay", label: "Horizontal Ray (Right Click)", icon: `↗` },
                        { type: "RangeTool", label: "Measure", icon: `⇔` },
                        { type: "Magnet", label: "Magnet", icon: `🧲` },
                        { type: "Trash", icon: `🗑️` }
                    ]
                });
                return;
            } catch (e) {
                console.warn(`[DataLoader] Failed with interval ${interval}:`, e);
                // try next candidate
            }
        }
        console.error(`[DataLoader] All intervals failed for TF=${this.TF}`);
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

    async loadMore(endTime, callback) {
        if (this.loading) return;
        this.loading = true;
        const targetMs = tfToMs(this.TF);
        const DEFAULT_BARS = 50;
        // Build candidate intervals (descending ms)
        const candidates = API_INTERVALS
            .map(i => ({ i, ms: tfToMs(i) }))
            .filter(o => o.ms <= targetMs && targetMs % o.ms === 0)
            .sort((a, b) => b.ms - a.ms);
        // Always try 1m as ultimate fallback
        const allCandidates = candidates.concat([{ i: '1m', ms: tfToMs('1m') }]);
        for (let { i: interval, ms: baseMs } of allCandidates) {
            const rawLimit = Math.ceil(DEFAULT_BARS * (targetMs / baseMs));
            const url = `${this.URL}?symbol=${this.SYM}` +
                        `&interval=${interval}&endTime=${endTime}&limit=${rawLimit}`;
            try {
                console.log(`Fetching historical data for ${this.SYM} at ${interval}, ending ${new Date(endTime).toISOString()}`);
                const result = await fetch(url);
                if (!result.ok) throw new Error(`HTTP ${result.status}`);
                const raw = await result.json();
                if (!raw || raw.length === 0) throw new Error('No data');
                const formatted = raw.map(x => this.format(x));
                const chunk = interval === this.TF
                    ? formatted
                    : this.aggregate(formatted, baseMs, targetMs);
                callback(chunk);
                break;
            } catch (e) {
                console.warn(`loadMore failed for interval ${interval}:`, e);
                continue;
            }
        }
        this.loading = false;
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
