import { tfToMs } from './timeframeUtils.js';
const API_INTERVALS = ['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','3d','1w','1M'];

class DataLoader {
    constructor(symbol = 'BTCUSDT', timeframe = '5m') {
        // Use Vite dev proxy to hit Binance REST without CORS
        this.URL = "/api/v3/klines";
        this.SYM = symbol;
        this.TF = timeframe; // Setting timeframe from constructor parameter
        this.loading = false;
    }

    async load(callback) {
        // Attempt fetching bars from the largest API-supported interval down to 1m
        const rawBars = 50;
        const targetMs = tfToMs(this.TF);
        // Build list of APIIntervals that evenly divide target timeframe
        const candidates = API_INTERVALS
            .map(i => ({ interval: i, ms: tfToMs(i) }))
            .filter(o => o.ms <= targetMs && targetMs % o.ms === 0)
            .sort((a, b) => b.ms - a.ms);
        // Always try 1m as last fallback
        candidates.push({ interval: '1m', ms: tfToMs('1m') });

        let raw;
        for (let { interval, ms: baseMs } of candidates) {
            // Calculate minimal limit, but do not exceed Binance's cap
            let limit = Math.ceil(rawBars * (targetMs / baseMs));
            limit = Math.min(limit, 1000);
            const url = `${this.URL}?symbol=${this.SYM}&interval=${interval}&limit=${limit}`;
            console.log(`load() trying ${interval} for TF=${this.TF}, limit=${limit}`);
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                if (!json || json.length === 0) throw new Error('Empty payload');
                raw = json;
                console.log(`load() success via ${interval}, received ${raw.length} raw bars`);
                // Found a usable raw dataset
                // Aggregate if needed
                const formatted = raw.map(x => this.format(x));
                const data = baseMs === targetMs
                    ? formatted
                    : this.aggregate(formatted, baseMs, targetMs);
                const finalData = data;
                console.log(`FinalData for ${this.SYM}, TF=${this.TF}: ` +
                    `length=${finalData.length}, ` +
                    `start=${new Date(finalData[0][0]).toISOString()}, ` +
                    `end=${new Date(finalData[finalData.length-1][0]).toISOString()}, ` +
                    `using interval=${interval}`);
                // Callback with full panes and tools definitions
                callback({
                    panes: [
                        {
                            scripts: [
                                { name: "BB", type: "BB", data: finalData, props: { length: 21, stddev: 2, color: "#2cc6c9ab" } },
                                { name: "TrippleEMA", type: "TrippleEMA" }
                            ],
                            overlays: [
                                { name: "BTC / Tether US", type: "Candles", main: true, data: finalData, props: {}, settings: { zIndex: 100, timeFrame: targetMs } },
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
                console.warn(`load() failed with interval ${interval}:`, e);
                // try next candidate
            }
        }
        console.error(`load() all intervals failed for TF=${this.TF}`);
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
