import { writable } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';

const WS_URL = 'ws://localhost:8001/ws';
const REST_URL = 'http://localhost:8001/signals';

export const trades = writable([]);
let socket;

function init(symbols = []) {
    if (socket) {
        socket.close();
        trades.set([]);
    }
    socket = new WebSocket(WS_URL);
    socket.addEventListener('open', () => {
        console.log('[signalService] WebSocket connected');
    });
    socket.addEventListener('message', ({ data }) => {
        try {
            const sig = JSON.parse(data);
            // Basic symbol filter
            if (!symbols.length || symbols.includes(sig.symbol)) {
                trades.update(list => [...list, sig]);
            }
        } catch (e) {
            console.error('[signalService] Invalid message', e);
        }
    });
    socket.addEventListener('close', () => console.log('[signalService] WebSocket closed'));
    socket.addEventListener('error', e => console.error('[signalService] WebSocket error', e));
}

/**
 * Send a test signal via REST for debugging (automatically generates id/event)
 */
export async function sendTestSignal(overrides = {}) {
    const now = Date.now();
    const price = overrides.entryPrice || 0;
    const signal = {
        id: uuidv4(),
        symbol: overrides.symbol || '',
        timeframe: overrides.timeframe || '',
        entryTime: now,
        entryPrice: price,
        stopLoss: overrides.stopLoss || price * (1 - 0.002),
        takeProfit: overrides.takeProfit || price * (1 + 0.005),
        trailingSL: {},
        trailingTP: {},
        confidence: overrides.confidence || 0.5,
        strategy: overrides.strategy || 'debug',
        eventType: 'open'
    };
    try {
        await fetch(REST_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(signal)
        });
    } catch (e) {
        console.error('[signalService] Failed to send test signal', e);
    }
    // Also update local store immediately
    trades.update(list => [...list, signal]);
}

export function closeSignal(id) {
    trades.update(list => {
        return list.map(s => s.id === id ? { ...s, eventType: 'close' } : s);
    });
}

export default { init, sendTestSignal, closeSignal };
