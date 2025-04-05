<script>
    import { createEventDispatcher } from 'svelte';
    
    // Define available symbols and timeframes
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'SOLUSDT'];
    const timeframes = [
        { value: '1m', label: '1m' },
        { value: '3m', label: '3m' },
        { value: '5m', label: '5m' },
        { value: '15m', label: '15m' },
        { value: '30m', label: '30m' },
        { value: '1h', label: '1h' },
        { value: '2h', label: '2h' },
        { value: '4h', label: '4h' },
        { value: '6h', label: '6h' },
        { value: '8h', label: '8h' },
        { value: '12h', label: '12h' },
        { value: '1d', label: '1d' },
        { value: '3d', label: '3d' },
        { value: '1w', label: '1w' },
        { value: '1M', label: '1M' }
    ];
    
    // Default values
    let selectedSymbol = 'BTCUSDT';
    let selectedTimeframe = '5m';
    
    // Event dispatcher to communicate with parent components
    const dispatch = createEventDispatcher();
    
    // Function to handle symbol selection
    function handleSymbolChange(event) {
        selectedSymbol = event.target.value;
        dispatchSelection();
    }
    
    // Function to handle timeframe selection
    function handleTimeframeChange(event) {
        selectedTimeframe = event.target.value;
        dispatchSelection();
    }
    
    // Dispatch the selected values to parent component
    function dispatchSelection() {
        dispatch('symbolSelected', {
            symbol: selectedSymbol,
            timeframe: selectedTimeframe
        });
    }
</script>

<div class="sidebar">
    <div class="logo">
        <h3>OmniCharts</h3>
    </div>
    
    <div class="controls">
        <div class="control-group">
            <label for="symbol-select">Symbol</label>
            <select id="symbol-select" bind:value={selectedSymbol} on:change={handleSymbolChange}>
                {#each symbols as symbol}
                    <option value={symbol}>{symbol}</option>
                {/each}
            </select>
        </div>
        
        <div class="control-group">
            <label for="timeframe-select">Timeframe</label>
            <select id="timeframe-select" bind:value={selectedTimeframe} on:change={handleTimeframeChange}>
                {#each timeframes as tf}
                    <option value={tf.value}>{tf.label}</option>
                {/each}
            </select>
        </div>
    </div>
</div>

<style>
    .sidebar {
        height: 100%;
        width: 200px;
        position: fixed;
        z-index: 1000;
        top: 0;
        left: 0;
        background-color: #1f1f1f;
        overflow-x: hidden;
        padding-top: 20px;
        color: #e0e0e0;
        box-shadow: 2px 0 5px rgba(0,0,0,0.3);
    }
    
    .logo {
        text-align: center;
        margin-bottom: 30px;
        padding: 0 10px;
    }
    
    .controls {
        padding: 0 15px;
    }
    
    .control-group {
        margin-bottom: 20px;
    }
    
    label {
        display: block;
        margin-bottom: 5px;
        font-size: 14px;
        color: #aaa;
    }
    
    select {
        width: 100%;
        padding: 8px;
        background-color: #2a2a2a;
        color: #e0e0e0;
        border: 1px solid #444;
        border-radius: 4px;
        outline: none;
    }
    
    select:focus {
        border-color: #606060;
    }
    
    @media (max-width: 768px) {
        .sidebar {
            width: 150px;
        }
    }
</style>
