//import WebSocket from 'ws'
import config from '../../../src/config.js';

var last_event = Infinity
var token = ''
var ws = null
var _ontrades = () => {}
var _onquotes = () => {}
var _onready = () => {}
var _onrefine = () => {}
var reconnecting = false
var ready = false
var symbols = []
var terminated = false
var reconnectAttempts = 0
var maxReconnectAttempts = 5
var reconnectTimeout = null

function now() {
    return new Date().getTime();
}

async function init(syms) {
    // If we already have an active connection, properly terminate it first
    if (ws) {
        // Properly close any existing WebSocket
        terminate(); // This will set ws to null
        ready = false; // Reset the ready state for the new connection
    }
    
    // Reset reconnection attempts when explicitly initializing
    reconnectAttempts = 0;
    symbols = syms; // Store the symbols to subscribe to
    
    // Clear any pending reconnect timers
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
    
    start_connection(); // Changed from start_hf to a more generic name
    
    // If connection error, try again with delay - this might be too aggressive or handled by reconnect logic
    // Consider removing or adjusting this generic timeout if reconnect logic is robust
    /*setTimeout(() => {
        if (!ready && !reconnecting && !terminated) init(symbols);
    }, 10000);*/
}

function start_connection() {
    // Message format for our Vercel proxy
    const subscribeMsg = {
        action: 'subscribe',
        symbols: symbols // Send the plain symbols array (e.g., ["BTCUSDT", "ETHUSDT"])
    };
    
    // Create a new WebSocket connection to the Vercel proxy
    try {
        console.log(`[wsx] Connecting to WebSocket proxy: ${config.websocketUrl}`);
        ws = new WebSocket(config.websocketUrl);
        
        ws.onmessage = function(e) {
            try {
                const data = JSON.parse(e.data.toString());

                // Handle status messages from the proxy
                if (data.type === 'status' || data.type === 'error') {
                    console.log(`[wsx] Proxy status/error: ${data.message}`);
                    if (data.message && data.message.includes("Subscribed to Binance")) {
                        ready = true; // Mark as ready when subscription is confirmed by proxy
                        _onready(); // Call the ready callback
                    }
                    return;
                }

                // Assuming data from Binance is relayed directly
                // The proxy sends raw Binance messages, so 'data.s' should exist for trades
                if (!data.s && !data.stream) { // Binance streams might have 'stream' field
                     console.log('[wsx] Received non-trade message or unknown format:', data);
                     return;
                }
                
                const streamSymbol = data.s ? data.s.toUpperCase() : (data.stream ? data.stream.split('@')[0].toUpperCase() : null);

                if (data.e === 'aggTrade' || (data.data && data.data.e === 'aggTrade')) {
                    const tradeData = data.data || data; // Handle wrapped data if present
                    if (symbols.some(s => s.toUpperCase() === streamSymbol)) {
                        _ontrades({
                            symbol: streamSymbol,
                            price: parseFloat(tradeData.p),
                            size: parseFloat(tradeData.q),
                        });
                    }
                } else if (data.e === 'ping' || (data.data && data.data.e === 'ping')) {
                    console.log('[wsx] PING received', data);
                    // Potentially send PONG back to proxy if required, though proxy should handle Binance pings
                } else {
                    // console.log('[wsx] Other message type:', data.e || data);
                }

                last_event = now();
                if (reconnectAttempts > 0) {
                    reconnectAttempts = 0; // Reset on successful data
                }
            } catch (err) {
                console.error('[wsx] Error processing message:', err.toString(), "Raw data:", e.data);
            }
        };
        
        ws.onopen = function() {
            try {
                console.log('[wsx] WebSocket connected to proxy. Subscribing to symbols:', symbols);
                console.log('[wsx] SEND >>>', JSON.stringify(subscribeMsg));
                ws.send(JSON.stringify(subscribeMsg)); // Send subscription message to proxy
                
                // Note: 'ready' state and _onready() call will be triggered by proxy's confirmation message.
                reconnectAttempts = 0; // Reset on successful connection to proxy
            } catch(err) {
                console.error('[wsx] Error on WebSocket open:', err.toString());
            }
        };
        
        ws.onclose = function (e) {
            if (terminated) {
                console.log("[wsx] WebSocket closed (terminated).");
                return;
            }
            ready = false; // No longer ready
            console.log(`[wsx] WebSocket closed with code: ${e.code}, reason: ${e.reason || 'No reason'}`);
            if (e.code !== 1000) { // Don't auto-reconnect on normal closure
                 reconnect();
            }
        };
        
        ws.onerror = function (err) {
            ready = false; // No longer ready
            console.error("[wsx] WebSocket error:", err.message || err);
            if (!terminated) {
                // ws.onclose will typically be called after an error, which then calls reconnect.
                // However, if onclose is not called, this ensures a reconnect attempt.
                // To avoid double reconnects, check if already reconnecting.
                if (!reconnecting) {
                    reconnect();
                }
            }
        };
    } catch (error) {
        console.error("[wsx] Error creating WebSocket connection to proxy:", error);
        if (!terminated) {
             reconnect();
        }
    }
}

function add_symbol(s) {
    if (symbols.includes(s)) {
        console.log(`[wsx] Symbol ${s} already in subscription list.`);
        return;
    }
    
    symbols.push(s);
    console.log(`[wsx] Added symbol ${s}. New list:`, symbols);

    // Send updated subscription to proxy
    const subscribeMsg = {
        action: 'subscribe',
        symbols: symbols // Send the full updated list
    };
    
    try {
        if (ws && ws.readyState === WebSocket.OPEN) {
            console.log('[wsx] Resubscribing with updated symbol list:', symbols);
            ws.send(JSON.stringify(subscribeMsg));
        } else {
            console.log('[wsx] WebSocket not open. Re-initializing for new symbol list.');
            // If websocket isn't ready, reinitialize with the new full list of symbols
            // Terminate existing connection attempt before re-init
            if (ws) terminate(); 
            init(symbols); // init will call start_connection
        }
    } catch(e) {
        console.error('[wsx] Error adding symbol and resubscribing:', e.toString());
    }
}

function reconnect() {
    if (terminated || reconnecting) {
        console.log(`[wsx] Reconnect skipped: terminated=${terminated}, reconnecting=${reconnecting}`);
        return;
    }
    
    reconnecting = true;
    ready = false;
    reconnectAttempts++;
    
    const backoffTime = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000); // Max 30s
    
    console.log(`[wsx] Reconnecting (attempt ${reconnectAttempts}/${maxReconnectAttempts})... Next attempt in ${backoffTime/1000}s`);
    
    try {
        if (ws) {
            try {
                ws.onopen = null; // Remove handlers to prevent issues during forced close
                ws.onmessage = null;
                ws.onerror = null;
                ws.onclose = null;
                if (ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
                    ws.close();
                }
            } catch (e) {
                console.warn("[wsx] Error closing WebSocket during reconnect prep:", e.toString());
            }
            ws = null;
        }
        
        if (reconnectAttempts <= maxReconnectAttempts) {
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
            reconnectTimeout = setTimeout(() => {
                reconnecting = false;
                if (!terminated) { // Double check not terminated before starting
                    start_connection(); // Use the new function name
                } else {
                    console.log("[wsx] Reconnect aborted as connection was terminated.");
                }
            }, backoffTime);
        } else {
            console.error("[wsx] Max reconnection attempts reached. Please check connection or refresh.");
            reconnecting = false;
            // Optionally call a global error handler or notify UI
        }
    } catch(e) {
        console.error('[wsx] Error in reconnect logic:', e.toString());
        reconnecting = false; // Ensure state is reset
    }
}

function print(data) { // This function seems to be for handling non-trade messages or initial ready state
    if (reconnecting) { // This was likely for UI refinement during reconnect attempts
        _onrefine();
    } else if (!ready) { // This was the old way of setting ready state
        // 'ready' state is now set upon receiving subscription confirmation from proxy
        // console.log('[wsx] Stream [OK] - (old ready logic)');
        // _onready();
        // ready = true;
        // last_event = now();
        // setTimeout(heartbeat, 10000); // Start heartbeat after ready
    }
    // If reconnecting was true, it should be set to false after a successful connection.
    // This is handled in ws.onopen and successful message receipt.
    // reconnecting = false; // This might be too early or too late depending on context
}

function heartbeat() {
    if (terminated) return;

    if (now() - last_event > 60000) { // 60 seconds no events
        console.warn('[wsx] No WebSocket events for 60 seconds. Attempting to reconnect.');
        if (!reconnecting) {
            reconnect();
        }
    }
    // Schedule next heartbeat check regardless
    // The original had different timeouts, simplifying to consistent check interval
    setTimeout(heartbeat, 15000); // Check every 15 seconds
}
// Start heartbeat after a delay once module is loaded, if not already started by 'ready' logic
// setTimeout(heartbeat, 15000); // Let's ensure it's started after initial connection attempt.

function terminate() {
    console.log("[wsx] Terminate called.");
    terminated = true; // Set terminated flag immediately
    ready = false;
    reconnecting = false;

    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    if (ws) {
        try {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                 ws.onopen = null; // Remove handlers
                 ws.onmessage = null;
                 ws.onerror = null;
                 ws.onclose = null; // Prevent onclose from triggering reconnect
                 ws.close(1000, "Client terminated connection"); // Normal closure
                 console.log("[wsx] WebSocket connection explicitly closed.");
            }
        } catch (e) {
            console.warn("[wsx] Error closing WebSocket during termination:", e.toString());
        }
        ws = null;
    }
    reconnectAttempts = 0; // Reset for future inits
    
    // Do not automatically reset 'terminated' flag here. 
    // It should stay true until a new 'init()' call.
}

export default {
    init,
    add_symbol,
    reconnect,
    terminate,
    set ontrades(val) {
        _ontrades = val
    },
    set onquotes(val) {
        _onquotes = val
    },
    set ready(val) {
        _onready = val
    },
    set refine(val) {
        _onrefine = val
    },
}
