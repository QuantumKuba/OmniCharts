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
    
    symbols = syms;
    start_hf(symbols);
    
    // If connection error, try again
    setTimeout(() => {
        if (!ready) init(symbols);
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
        } catch (e) {
            // log
            console.log(e.toString())
        }
    };
    
    ws.onopen = function() {
        try {
            // Map symbols to lowercase and add @aggTrade suffix
            let syms = symbols.map(x => x.toLowerCase() + "@aggTrade")
            console.log('SEND >>>', JSON.stringify(msg(syms)))
            ws.send(JSON.stringify(msg(syms)))
        } catch(e) {
            console.log(e.toString())
        }
    };
    
    ws.onclose = function (e) {
        switch (e.code) {
            case 1000:
                console.log("WebSocket: closed normally");
                break;
            default:
                console.log(`WebSocket closed with code: ${e.code}, reason: ${e.reason}`);
                break;
        }
        //reconnect();
    };
    
    ws.onerror = function (e) {
        console.log("WebSocket error:", e);
        reconnect();
    };
}

function add_symbol(s) {
    var msg = sym => ({
        'op': 'subscribe',
        'channel': 'trades',
        'market': sym
    })
    try {
        ws.send(JSON.stringify(msg(s)))
    } catch(e) {
        console.log(e.toString())
    }
}

function reconnect() {
    reconnecting = true
    console.log('Reconnecting...')
    try {
        ws.close()
        setTimeout(() => start_hf(symbols) , 1000)
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
            ws.close();
        } catch (e) {
            console.log("Error closing WebSocket:", e);
        }
    }
    terminated = true;
    ready = false;
    reconnecting = false;
    
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

/*
var last_event = Infinity;
var ws = null;
var _ontrades = () => {};
var _onquotes = () => {};
var _onready = () => {};
var _onrefine = () => {};
var reconnecting = false;
var ready = false;
var symbols = [];

function now() {
  return new Date().getTime();
}

async function init(syms) {
  if (ready) return;

  symbols = syms;
  start_hf(symbols);

  // If connection error, try again
  setTimeout(() => init(symbols), 10000);
}

function start_hf() {
  // To subscribe to this channel:
  var msg = (sym) => ({
    op: "subscribe",
    channel: "trades",
    market: sym
  });

  ws = new WebSocket(`wss://ftx.com/ws`);
  ws.onmessage = function (e) {
    try {
      let data = JSON.parse(e.data);
      if (!data.data) return print(data);
      switch (data.channel) {
        case "trades":
          for (var d of data.data) {
            d.symbol = data.market;
            _ontrades(d);
          }
          break;
      }
      last_event = now();
    } catch (e) {
      // log
      console.log(e.toString());
    }
  };
  ws.onopen = function () {
    try {
      for (var s of symbols) {
        ws.send(JSON.stringify(msg(s)));
      }
    } catch (e) {
      console.log(e.toString());
    }
  };
  ws.onclose = function (e) {
    switch (e) {
      case 1000:
        console.log("WebSocket: closed");
        break;
    }
    reconnect();
  };
  ws.onerror = function (e) {
    console.log("WS", e);
    reconnect();
  };
}

function reconnect() {
  reconnecting = true;
  console.log("Reconnecting...");
  try {
    ws.close();
    // ws.removeAllListeners();
    setTimeout(() => start_hf(symbols), 1000);
  } catch (e) {
    console.log(e.toString());
  }
}

function print(data) {
  if (data.type === "subscribed") {
    // TODO: refine the chart
    if (reconnecting) {
      _onrefine();
    } else if (!ready) {
      console.log("Stream [OK]");
      _onready();
      ready = true;
      last_event = now();
      setTimeout(heartbeat, 10000);
    }
    reconnecting = false;
  }
}

function heartbeat() {
  if (now() - last_event > 60000) {
    console.log("No events for 60 seconds");
    if (!reconnecting) reconnect();
    setTimeout(heartbeat, 10000);
  } else {
    setTimeout(heartbeat, 1000);
  }

module.exports = {
  init,
  reconnect,
  set ontrades(val) {
    _ontrades = val;
  },
  set ready(val) {
    _onready = val;
  }
};
*/
