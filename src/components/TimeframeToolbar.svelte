<script>
    import DataHub from "../core/dataHub.js";
    import TimeframeToolbarItem from "./TimeframeToolbarItem.svelte";
    import Events from "../core/events.js";
    import MetaHub from "../core/metaHub.js";
    import { createEventDispatcher, onMount } from 'svelte';
    import { slide } from 'svelte/transition';
    import utilsMethods from "../stuff/utils.js";
    const { parseTf: tfToMs, msToTf } = utilsMethods;

    // Component props
    export let props = {};
    export const layout = {};
    export const main = {};
    
    // Initialize services
    let events = Events.instance(props.id);
    let meta = MetaHub.instance(props.id);
    let hub = DataHub.instance(props.id);
    const dispatch = createEventDispatcher();

    // Component IDs
    let toolbarId = `${props.id}-timeframe-toolbar`;
    
    // Default selected values - Get initial values from the chart if available
    let selectedSymbol = hub.mainOv?.settings?.symbol || window.currentSymbol || 'BTCUSDT';
    let selectedTimeframe = hub.mainOv?.settings?.timeFrame || props.timeFrame || window.currentTimeframe || "5m";
    
    // Keep track of last known valid symbol to prevent it from being lost
    let lastValidSymbol = selectedSymbol;
    
    // Debug indicator to check state synchronization
    let stateCheckCount = 0;
    let lastStateCheck = Date.now();

    // Height of the timeframe toolbar
    const toolbarHeight = `${props.config.TOOLBAR - 20}px`;
    
    // Define available symbols and timeframes - exact match with SymbolSidebar
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'SOLUSDT'];
    const timeframes = [
        { value: '1m', label: '1m' },
        { value: '3m', label: '3m' },
        { value: '5m', label: '5m' },
        { value: '9m', label: '9m' },
        { value: '15m', label: '15m' },
        { value: '27m', label: '27m' },
        { value: '30m', label: '30m' },
        { value: '1h', label: '1h' },
        { value: '2h', label: '2h' },
        { value: '3h', label: '3h' },
        { value: '4h', label: '4h' },
        { value: '6h', label: '6h' },
        { value: '8h', label: '8h' },
        { value: '12h', label: '12h' },
        { value: '1d', label: '1d' },
        { value: '3d', label: '3d' },
        { value: '1w', label: '1w' },
        { value: '1M', label: '1M' }
    ];

    // Styling properties
    let colors = props.colors;
    let b = props.config.TB_BORDER;
    let brd = colors.tbBorder || colors.scale;
    let st = props.config.TB_B_STYLE;
    
    // Toolbar style - positioned horizontally at top of chart
    $:toolbarStyle = `
        // left: ${props.config.TOOLBAR}px;
        left: 0;
        top: 0;
        right: 0;
        position: absolute;
        background: ${props.colors.back};
        height: ${toolbarHeight};
        border-bottom: ${b}px ${st} ${brd};
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 10px;
    `;

    // Toggle dropdown for symbol selection
    let showSymbolDropdown = false;
    function toggleSymbolDropdown() {
        showSymbolDropdown = !showSymbolDropdown;
    }

    // Close dropdown when clicking outside
    function handleClickOutside(event) {
        const target = event.target;
        if (!target.closest('.symbol-selector') && showSymbolDropdown) {
            showSymbolDropdown = false;
        }
    }
    
    // Function to handle symbol selection
    function selectSymbol(symbol) {
        if (!symbol) return;
        
        // Save the symbol for future reference
        lastValidSymbol = symbol;
        selectedSymbol = symbol;
        showSymbolDropdown = false;
        
        dispatchSelection();
        
        console.log(`[TimeframeToolbar] Symbol selected: ${symbol}, timeframe: ${selectedTimeframe}`);
    }
    
    // Function to handle timeframe selection
    function selectTimeframe(timeframe) {
        if (!timeframe) return;
        
        selectedTimeframe = timeframe;
        
        // Ensure we preserve the current symbol when changing timeframes
        if (!selectedSymbol || selectedSymbol === '') {
            console.warn('[TimeframeToolbar] No symbol selected when changing timeframe. Current symbol from hub:', hub.mainOv?.settings?.symbol);
            console.warn('[TimeframeToolbar] Using last valid symbol:', lastValidSymbol);
            
            // Check if main overlay has a valid symbol
            if (hub.mainOv?.settings?.symbol) {
                selectedSymbol = hub.mainOv.settings.symbol;
            } else if (window.currentSymbol) {
                selectedSymbol = window.currentSymbol;
            } else {
                selectedSymbol = lastValidSymbol;
            }
        }
        
        dispatchSelection();
        
        console.log(`[TimeframeToolbar] Timeframe selected: ${timeframe} for symbol: ${selectedSymbol}`);
    }
    
    // Dispatch the selected values to update the chart - KEY FUNCTION
    function dispatchSelection() {
        try {
            // Prevent symbol reset by checking current values in multiple places
            if (!selectedSymbol) {
                // Try getting the symbol from various places
                let symbolFromHub = hub.mainOv?.settings?.symbol;
                let symbolFromWindow = window.currentSymbol;
                let symbolFromMeta = meta.symbol;
                
                console.error('[TimeframeToolbar] Missing symbol in dispatchSelection, checking alternatives:');
                console.error(`- hub: ${symbolFromHub}, window: ${symbolFromWindow}, meta: ${symbolFromMeta}, last: ${lastValidSymbol}`);
                
                // Use the first valid symbol we can find
                selectedSymbol = symbolFromHub || symbolFromWindow || symbolFromMeta || lastValidSymbol;
            }
            
            // Ensure timeframe is in string format
            const normalizedTimeframe = msToTf(selectedTimeframe);
            
            // Create event data object
            const eventData = {
                symbol: selectedSymbol,
                timeframe: normalizedTimeframe
            };
            
            console.log(`[TimeframeToolbar] Dispatching: symbol=${selectedSymbol}, timeframe=${normalizedTimeframe}`);
            
            // First dispatch event to parent component
            dispatch('symbolSelected', eventData);
            
            // Then update the chart using the event system
            if (hub.mainOv) {
                // Update main overlay settings
                if (!hub.mainOv.settings) hub.mainOv.settings = {};
                hub.mainOv.settings.symbol = selectedSymbol;
                hub.mainOv.settings.timeFrame = normalizedTimeframe;
            }
            
            // Also update global state explicitly to ensure persistence
            window.currentSymbol = selectedSymbol;
            window.currentTimeframe = normalizedTimeframe;
            
            // EMERGENCY BACKUP PREVENTION - store the current symbol/timeframe in localStorage
            try {
                localStorage.setItem('omni_currentSymbol', selectedSymbol);
                localStorage.setItem('omni_currentTimeframe', normalizedTimeframe);
            } catch (e) {
                // Storage might be disabled, ignore
            }
            
            // Directly call the global handler if available
            if (window.handleSymbolChange) {
                window.handleSymbolChange({
                    detail: eventData
                });
            }
            
            // Also emit a chart:symbol-changed event for other components
            events.emit('chart:symbol-changed', eventData);
            
            // Update our last valid symbol
            lastValidSymbol = selectedSymbol;
        } catch (e) {
            console.error("[TimeframeToolbar] Error in dispatchSelection:", e);
        }
    }
    
    // Periodically check and reconcile state between hub and local component
    function checkState() {
        stateCheckCount++;
        lastStateCheck = Date.now();
        
        // Get values from different sources
        const hubSymbol = hub.mainOv?.settings?.symbol;
        const hubTimeframe = hub.mainOv?.settings?.timeFrame;
        const windowSymbol = window.currentSymbol;
        const windowTimeframe = window.currentTimeframe;
        
        // Check for mismatches
        if (hubSymbol && hubSymbol !== selectedSymbol) {
            console.warn(`[TimeframeToolbar] State mismatch - local symbol: ${selectedSymbol}, hub symbol: ${hubSymbol}`);
            selectedSymbol = hubSymbol;
            lastValidSymbol = hubSymbol;
        }
        
        if (hubTimeframe && hubTimeframe !== selectedTimeframe) {
            console.warn(`[TimeframeToolbar] State mismatch - local timeframe: ${selectedTimeframe}, hub timeframe: ${hubTimeframe}`);
            selectedTimeframe = hubTimeframe;
        }
        
        // Schedule next check (light enough to run often)
        setTimeout(checkState, 2000);
    }
    
    // Initialize TimeframeToolbar when the chart loads or changes
    events.on('chart:symbol-changed', event => {
        // Update local state when symbol changes elsewhere
        if (event.symbol) {
            selectedSymbol = event.symbol;
            lastValidSymbol = event.symbol; // Remember this valid symbol
        }
        if (event.timeframe) {
            selectedTimeframe = event.timeframe;
        }
        
        console.log(`[TimeframeToolbar] Received chart:symbol-changed: symbol=${event.symbol}, timeframe=${event.timeframe}`);
    });
    
    // Also listen for startup events
    events.on('chart-data-loaded', () => {
        // Check if main overlay settings exist and update our UI
        if (hub.mainOv?.settings?.symbol) {
            selectedSymbol = hub.mainOv.settings.symbol;
            lastValidSymbol = selectedSymbol; // Remember this valid symbol
        }
        if (hub.mainOv?.settings?.timeFrame) {
            selectedTimeframe = hub.mainOv.settings.timeFrame;
        }
        
        console.log(`[TimeframeToolbar] Chart data loaded: symbol=${selectedSymbol}, timeframe=${selectedTimeframe}`);
    });
    
    // When component mounts, recover from localStorage if needed and start state checks
    onMount(() => {
        // Try to recover from localStorage if there's nothing yet
        if (!selectedSymbol && localStorage.getItem('omni_currentSymbol')) {
            selectedSymbol = localStorage.getItem('omni_currentSymbol');
            lastValidSymbol = selectedSymbol;
        }
        
        if (!selectedTimeframe && localStorage.getItem('omni_currentTimeframe')) {
            selectedTimeframe = localStorage.getItem('omni_currentTimeframe');
        }
        
        // Start periodic state checking
        setTimeout(checkState, 1000);
    });
</script>

<svelte:window on:mousedown={handleClickOutside}/>

<div id={toolbarId} style={toolbarStyle} class="nvjs-timeframe-toolbar">
    <!-- Symbol Selector -->
    <div class="symbol-selector">
        <button class="selected-symbol" on:click={toggleSymbolDropdown}>
            <span class="symbol-name">{selectedSymbol}</span>
            <span class="dropdown-arrow">▼</span>
        </button>
        {#if showSymbolDropdown}
            <div class="dropdown-menu symbol-dropdown" transition:slide={{duration: 100}}>
                {#each symbols as symbol}
                    <button 
                        type="button"
                        class="dropdown-item {selectedSymbol === symbol ? 'active' : ''}" 
                        on:click={() => selectSymbol(symbol)}
                    >
                        {symbol}
                    </button>
                {/each}
            </div>
        {/if}
    </div>
    
    <!-- Timeframe Selector -->
    <div class="timeframes-container">
        {#each timeframes as item}
            <button 
                type="button"
                class="nvjs-timeframe-item {selectedTimeframe === item.value ? 'selected' : ''}"
                on:click={() => selectTimeframe(item.value)}
                title={`Change timeframe to ${item.label}`}
            >
                {item.label}
            </button>
        {/each}
    </div>
</div>

<style>
    .nvjs-timeframe-toolbar {
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;
        gap: 10px;
        user-select: none;
    }
    
    .nvjs-timeframe-item {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        color: #9ca3af;
        border: none;
        border-radius: 2px;
        padding: 3px 8px;
        font-size: 12px;
        cursor: pointer;
        transition: background-color 0.2s ease, color 0.2s ease;
        min-width: 32px;
        height: 24px;
    }
    
    .nvjs-timeframe-item:hover {
        background-color: #363c4e;
        color: #e0e0e0;
    }
    
    .nvjs-timeframe-item.selected {
        background-color: #dd9801;
        color: white;
        font-weight: 500;
    }
    
    .timeframes-container {
        display: flex;
        flex-wrap: nowrap;
        gap: 5px;
        align-items: center;
        overflow-x: auto;
        max-width: 80%;
        scrollbar-width: thin;
        scrollbar-color: #363c4e transparent;
    }
    
    .timeframes-container::-webkit-scrollbar {
        height: 4px;
    }
    
    .timeframes-container::-webkit-scrollbar-track {
        background: transparent;
    }
    
    .timeframes-container::-webkit-scrollbar-thumb {
        background-color: #363c4e;
        border-radius: 6px;
    }
    
    .symbol-selector {
        position: relative;
        display: flex;
        align-items: center;
        margin-right: 10px;
    }
    
    .selected-symbol {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #2a2e39;
        color: #e0e0e0;
        border: none;
        border-radius: 4px;
        padding: 4px 12px;
        cursor: pointer;
        min-width: 120px;
        font-weight: 600;
        font-size: 12px;
        transition: background-color 0.2s;
    }
    
    .selected-symbol:hover {
        background: #363c4e;
    }
    
    .symbol-name {
        margin-right: 8px;
    }
    
    .dropdown-arrow {
        font-size: 8px;
        margin-left: auto;
    }
    
    .dropdown-menu {
        position: absolute;
        top: 100%;
        left: 0;
        margin-top: 4px;
        background: #2a2e39;
        border-radius: 4px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        overflow: hidden;
        z-index: 100;
        min-width: 120px;
        max-height: 300px;
        overflow-y: auto;
    }
    
    .dropdown-item {
        width: 100%;
        padding: 8px 12px;
        cursor: pointer;
        color: #e0e0e0;
        font-size: 12px;
        border: none;
        background: transparent;
        text-align: left;
        transition: background-color 0.2s;
    }
    
    .dropdown-item:hover, .dropdown-item.active {
        background: #dd9801;
    }
</style>
