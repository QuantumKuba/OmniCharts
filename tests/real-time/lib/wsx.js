//import WebSocket from 'ws'

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
        terminate();
        ready = false; // Reset the ready state for the new connection
    }
    
    // Reset reconnection attempts when explicitly initializing
    reconnectAttempts = 0;
    symbols = syms;
    
    // Clear any pending reconnect timers
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
    
    start_hf(symbols);
    
    // If connection error, try again with delay
    setTimeout(() => {
        if (!ready && !reconnecting && !terminated) init(symbols);
    }, 10000);
}

function start_hf() {
    // To subscribe to this channel:
    var msg = syms => ({
        'method': 'SUBSCRIBE',
        "params": syms,
        "id": 1
    })
    
    // Create a new WebSocket connection
    try {
        ws = new WebSocket(`wss://stream.binance.com:9443/ws`);
        
        ws.onmessage = function(e) {
            try {
                let data = JSON.parse(e.data)
                if (!data.s) return print(data)
                switch (data.e) {
                    case 'aggTrade':
                        // Only process trades for current symbols
                        // Ensure case-insensitive comparison
                        const dataSymbol = data.s.toUpperCase();
                        if (symbols.some(s => s.toUpperCase() === dataSymbol)) {
                            _ontrades({
                                symbol: dataSymbol,
                                price: parseFloat(data.p),
                                size: parseFloat(data.q),
                            })
                        }
                        break
                    case 'ping':
                        console.log('PING', data)
                        break
                }
                last_event = now()
                
                // Reset reconnect attempts on successful data
                if (reconnectAttempts > 0) {
                    reconnectAttempts = 0;
                }
            } catch (e) {
                // log
                console.log(e.toString())
            }
        };
        
        ws.onopen = function() {
            try {
                // Map symbols to lowercase and add @aggTrade suffix
                let syms = symbols.map(x => x.toLowerCase() + "@aggTrade")
                console.log('WebSocket Connected - Subscribing to:', symbols)
                console.log('SEND >>>', JSON.stringify(msg(syms)))
                ws.send(JSON.stringify(msg(syms)))
                
                // Reset reconnect attempts on successful connection
                reconnectAttempts = 0;
            } catch(e) {
                console.log(e.toString())
            }
        };
        
        ws.onclose = function (e) {
            if (terminated) return; // Don't reconnect if terminate was called
            
            switch (e.code) {
                case 1000:
                    console.log("WebSocket: closed normally");
                    break;
                default:
                    console.log(`WebSocket closed with code: ${e.code}, reason: ${e.reason}`);
                    reconnect();
                    break;
            }
        };
        
        ws.onerror = function (e) {
            console.log("WebSocket error:", e);
            // Only reconnect if not terminated
            if (!terminated) {
                reconnect();
            }
        };
    } catch (error) {
        console.error("Error creating WebSocket:", error);
        reconnect();
    }
}

function add_symbol(s) {
    if (symbols.includes(s)) return; // Already subscribed
    
    symbols.push(s);
    
    var msg = sym => ({
        'method': 'SUBSCRIBE',
        "params": [sym.toLowerCase() + "@aggTrade"],
        "id": 1
    })
    
    try {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg(s)))
        } else {
            // If websocket isn't ready, reinitialize
            init(symbols);
        }
    } catch(e) {
        console.log(e.toString())
    }
}

function reconnect() {
    if (terminated || reconnecting) return;
    
    reconnecting = true;
    reconnectAttempts++;
    
    // Exponential backoff for reconnection attempts
    const backoffTime = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
    
    console.log(`Reconnecting (attempt ${reconnectAttempts}/${maxReconnectAttempts})... Next attempt in ${backoffTime/1000}s`);
    
    try {
        if (ws) {
            try {
                ws.close();
            } catch (e) {
                console.log("Error closing WebSocket:", e);
            }
            ws = null;
        }
        
        if (reconnectAttempts <= maxReconnectAttempts) {
            // Clear any existing timeout
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
            
            // Schedule reconnection
            reconnectTimeout = setTimeout(() => {
                reconnecting = false;
                start_hf(symbols);
            }, backoffTime);
        } else {
            console.log("Max reconnection attempts reached. Please refresh the page.");
            reconnecting = false;
        }
    } catch(e) {
        console.log(e.toString())
    }
}

function print(data) {
    // TODO: refine the chart
    if (reconnecting) {
        _onrefine()
    } else if (!ready) {
        console.log('Stream [OK]')
        _onready()
        ready = true
        last_event = now()
        setTimeout(heartbeat, 10000)
    }
    reconnecting = false
}

function heartbeat() {
    if (terminated) return
    if (now() - last_event > 60000) {
        console.log('No events for 60 seconds')
        if (!reconnecting) reconnect()
        setTimeout(heartbeat, 10000)
    } else {
        setTimeout(heartbeat, 1000)
    }
}

function terminate() {
    if (ws && ws.readyState !== WebSocket.CLOSED) {
        try {
            terminated = true; // Set terminated before closing to prevent reconnection
            ws.close();
            console.log("WebSocket connection terminated");
        } catch (e) {
            console.log("Error closing WebSocket:", e);
        }
    }
    
    // Clear any pending reconnect timeout
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
    
    terminated = true;
    ready = false;
    reconnecting = false;
    reconnectAttempts = 0;
    
    // Reset to allow new connections
    setTimeout(() => {
        terminated = false;
    }, 500);
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
