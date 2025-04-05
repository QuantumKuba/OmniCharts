// Make new candles from trade stream
export default function sample(ohlcv, trade, tf = 300000) {
    let last = ohlcv[ohlcv.length - 1];
    if (!last) return;
    
    let tick = trade["price"];
    let volume = trade["volume"] || 0;
    let tNext = last[0] + tf; // Next candle timestamp
    let tn = new Date().getTime(); // Current time
    
    // Check if we're in the current candle's timeframe or need to create a new one
    if (tn >= tNext) {
        // Time for a new candle - align to timeframe boundary
        let t = tn - (tn % tf);
        
        // Create a new candle
        let nc = [t, tick, tick, tick, tick, volume];
        ohlcv.push(nc);
        return true; // Signal that we created a new candle
    } else {
        // Still within the current candle's timeframe - update it
        last[2] = Math.max(tick, last[2]); // Update high
        last[3] = Math.min(tick, last[3]); // Update low
        last[4] = tick; // Update close
        last[5] += volume; // Add volume
        return false; // Signal regular update
    }
}
