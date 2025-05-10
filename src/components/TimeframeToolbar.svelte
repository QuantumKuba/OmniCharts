<script>
    import DataHub from "../core/dataHub.js";
    import TimeframeToolbarItem from "./TimeframeToolbarItem.svelte";
    import Events from "../core/events.js";
    import MetaHub from "../core/metaHub.js";
    import { createEventDispatcher } from 'svelte';
    import { slide } from 'svelte/transition';

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
    let selectedSymbol = hub.mainOv?.settings?.symbol || 'BTCUSDT';
    let selectedTimeframe = hub.mainOv?.settings?.timeFrame || props.timeFrame || "5m";
    
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
        left: ${props.config.TOOLBAR}px;
        top: 0;
        right: 0;
        position: absolute;
        background: ${props.colors.back};
        height: ${toolbarHeight};
        border-bottom: ${b}px ${st} ${brd};
        z-index: 1;
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
        selectedSymbol = symbol;
        showSymbolDropdown = false;
        dispatchSelection();
    }
    
    // Function to handle timeframe selection
    function selectTimeframe(timeframe) {
        selectedTimeframe = timeframe;
        dispatchSelection();
    }
    
    // Dispatch the selected values to update the chart - KEY FUNCTION
    function dispatchSelection() {
        // First dispatch event to parent component
        dispatch('symbolSelected', {
            symbol: selectedSymbol,
            timeframe: selectedTimeframe
        });
        
        // Then update the chart using the event system
        if (hub.mainOv) {
            // Update main overlay settings
            if (!hub.mainOv.settings) hub.mainOv.settings = {};
            hub.mainOv.settings.symbol = selectedSymbol;
            hub.mainOv.settings.timeFrame = selectedTimeframe;
        }
        
        // Emit a chart:symbol-changed event - this triggers the onSymbolChanged handler
        events.emit('chart:symbol-changed', {
            symbol: selectedSymbol,
            timeframe: selectedTimeframe
        });
    }
    
    // Initialize TimeframeToolbar when the chart loads or changes
    events.on('chart:symbol-changed', event => {
        // Update local state when symbol changes elsewhere
        if (event.symbol) selectedSymbol = event.symbol;
        if (event.timeframe) selectedTimeframe = event.timeframe;
    });
    
    // Also listen for startup events
    events.on('chart-data-loaded', () => {
        // Check if main overlay settings exist and update our UI
        if (hub.mainOv?.settings?.symbol) {
            selectedSymbol = hub.mainOv.settings.symbol;
        }
        if (hub.mainOv?.settings?.timeFrame) {
            selectedTimeframe = hub.mainOv.settings.timeFrame;
        }
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
        background-color: #3d82ce;
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
        background: #3d82ce;
    }
</style>