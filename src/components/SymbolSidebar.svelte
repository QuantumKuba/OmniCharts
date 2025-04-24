<script>
    import { createEventDispatcher } from 'svelte';
    import { slide } from 'svelte/transition';
    
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
    function selectSymbol(symbol) {
        selectedSymbol = symbol;
        dispatchSelection();
    }
    
    // Function to handle timeframe selection
    function selectTimeframe(timeframe) {
        selectedTimeframe = timeframe;
        dispatchSelection();
    }
    
    // Dispatch the selected values to parent component
    function dispatchSelection() {
        dispatch('symbolSelected', {
            symbol: selectedSymbol,
            timeframe: selectedTimeframe
        });
    }

    // Toggle dropdown for symbol selection
    let showSymbolDropdown = false;
    function toggleSymbolDropdown() {
        showSymbolDropdown = !showSymbolDropdown;
        if (showSymbolDropdown) {
            showTimeframeDropdown = false;
        }
    }

    // Close dropdown when clicking outside
    function handleClickOutside(event) {
        const target = event.target;
        if (!target.closest('.symbol-selector') && showSymbolDropdown) {
            showSymbolDropdown = false;
        }
        if (!target.closest('.timeframe-selector') && showTimeframeDropdown) {
            showTimeframeDropdown = false;
        }
    }

    // Toggle dropdown for timeframe selection
    let showTimeframeDropdown = false;
    function toggleTimeframeDropdown() {
        showTimeframeDropdown = !showTimeframeDropdown;
        if (showTimeframeDropdown) {
            showSymbolDropdown = false;
        }
    }
</script>

<svelte:window on:click={handleClickOutside}/>

<div class="chart-controls">
    <div class="chart-control-group">
        <!-- Symbol Selector -->
        <div class="symbol-selector">
            <button class="selected-item" on:click={toggleSymbolDropdown}>
                <span class="symbol-name">{selectedSymbol}</span>
                <span class="dropdown-arrow">▼</span>
            </button>
            {#if showSymbolDropdown}
                <div class="dropdown-menu symbol-dropdown" transition:slide={{duration: 100}}>
                    {#each symbols as symbol}
                        <div 
                            class="dropdown-item {selectedSymbol === symbol ? 'active' : ''}" 
                            on:click={() => selectSymbol(symbol)}
                        >
                            {symbol}
                        </div>
                    {/each}
                </div>
            {/if}
        </div>

        <!-- Timeframe Selector - Now horizontal row of buttons -->
        <div class="timeframe-selector">
            <div class="timeframe-buttons">
                {#each timeframes as tf}
                    <button 
                        class="timeframe-button {selectedTimeframe === tf.value ? 'active' : ''}" 
                        on:click={() => selectTimeframe(tf.value)}
                    >
                        {tf.label}
                    </button>
                {/each}
            </div>
        </div>
    </div>
</div>

<style>
    .chart-controls {
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 600;
        display: flex;
        align-items: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
        font-size: 12px;
        pointer-events: none; /* Container is not clickable, only its contents */
    }
    
    .chart-control-group {
        display: flex;
        flex-direction: column;
        align-items: center;
        background: rgba(30, 34, 45, 0.8);
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        padding: 2px;
        pointer-events: auto; /* Make controls clickable */
    }
    
    .symbol-selector {
        position: relative;
        margin-bottom: 2px;
        width: 100%;
    }
    
    .selected-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #2a2e39;
        color: #e0e0e0;
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        cursor: pointer;
        width: 100%;
        font-weight: 600;
        font-size: 11px;
        transition: background-color 0.2s;
    }
    
    .selected-item:hover {
        background: #363c4e;
    }
    
    .symbol-name {
        margin-right: 5px;
    }
    
    .dropdown-arrow {
        font-size: 8px;
        margin-left: auto;
    }
    
    .dropdown-menu {
        position: absolute;
        top: 100%;
        left: 0;
        margin-top: 2px;
        background: #2a2e39;
        border-radius: 4px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        overflow: hidden;
        z-index: 1000;
        min-width: 120px;
        max-height: 200px;
        overflow-y: auto;
    }
    
    .dropdown-item {
        padding: 6px 10px;
        cursor: pointer;
        color: #e0e0e0;
        font-size: 11px;
        transition: background-color 0.2s;
    }
    
    .dropdown-item:hover, .dropdown-item.active {
        background: #3d82ce;
    }
    
    .timeframe-selector {
        display: flex;
        align-items: center;
        width: 100%;
    }
    
    .timeframe-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 2px;
        justify-content: center;
        padding: 2px;
        width: 100%;
    }
    
    .timeframe-button {
        background: #2a2e39;
        border: none;
        color: #9ca3af;
        padding: 3px 4px;
        font-size: 10px;
        cursor: pointer;
        border-radius: 2px;
        min-width: 22px;
        text-align: center;
    }
    
    .timeframe-button:hover {
        background: #363c4e;
        color: #e0e0e0;
    }
    
    .timeframe-button.active {
        background: #3d82ce;
        color: white;
        font-weight: 500;
    }
    
    @media (min-width: 768px) {
        .chart-control-group {
            flex-direction: row;
            padding: 3px;
        }
        
        .symbol-selector {
            margin-bottom: 0;
            margin-right: 3px;
            width: auto;
        }
        
        .timeframe-buttons {
            justify-content: flex-start;
        }
    }
</style>
