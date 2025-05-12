<script>
    import DataHub from "../core/dataHub.js";
    import TimeframeToolbarItem from "./TimeframeToolbarItem.svelte";
    import Events from "../core/events.js";
    import MetaHub from "../core/metaHub.js";
    import { createEventDispatcher, onMount, tick } from 'svelte';
    import { slide, fade } from 'svelte/transition';
    import utilsMethods from "../stuff/utils.js";
    import symbolService from "../services/symbolService.js";
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
    
    // Symbol search and selection state
    let isLoading = true;
    let symbolSearchQuery = "";
    let availableSymbols = [];
    let topSymbols = [];
    let symbolCategories = [];
    let filteredSymbols = [];
    let selectedCategory = "USDT";
    let favoriteSymbols = [];

    // Add special categories for favorite symbols
    const FAVORITES_CATEGORY = "★"; // Using a star to represent favorites

    // Timeframes
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

    // Symbol dropdown state
    let showSymbolDropdown = false;
    let searchInputElement;

    // Toggle symbol dropdown
    function toggleSymbolDropdown() {
        showSymbolDropdown = !showSymbolDropdown;
        
        // Focus the search input when opening the dropdown
        if (showSymbolDropdown) {
            setTimeout(() => {
                if (searchInputElement) {
                    searchInputElement.focus();
                }
            }, 100);
        } else {
            // Clear search when closing dropdown
            symbolSearchQuery = "";
            updateFilteredSymbols();
        }
    }

    // Close dropdown when clicking outside
    function handleClickOutside(event) {
        const target = event.target;
        if (!target.closest('.symbol-selector') && showSymbolDropdown) {
            showSymbolDropdown = false;
            // Clear search when closing dropdown
            symbolSearchQuery = "";
            updateFilteredSymbols();
        }
    }
    
    // Function to handle symbol selection
    function selectSymbol(symbol) {
        if (!symbol) return;
        
        // Save the symbol for future reference
        lastValidSymbol = symbol;
        selectedSymbol = symbol;
        showSymbolDropdown = false;
        
        // Clear search query
        symbolSearchQuery = "";
        updateFilteredSymbols();
        
        dispatchSelection();
        
        console.log(`[TimeframeToolbar] Symbol selected: ${symbol}, timeframe: ${selectedTimeframe}`);
    }
    
    // Function to toggle a symbol as favorite
    async function toggleFavorite(symbol, event) {
        // Stop event propagation to prevent the dropdown item click handler from being triggered
        if (event) {
            event.stopPropagation();
        }
        
        // Toggle favorite status
        const isFav = symbolService.toggleFavorite(symbol);
        
        // Refresh favorites list
        favoriteSymbols = await symbolService.getFavorites();
        
        // If we're in favorites view, refresh the list
        if (selectedCategory === FAVORITES_CATEGORY) {
            filteredSymbols = favoriteSymbols;
        }
        
        console.log(`[TimeframeToolbar] ${isFav ? 'Added' : 'Removed'} ${symbol} ${isFav ? 'to' : 'from'} favorites`);
        return false; // Prevent default action
    }
    
    // Check if a symbol is a favorite
    function isSymbolFavorite(symbol) {
        return symbolService.isFavorite(symbol);
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
    
    // Search symbols by query
    async function searchSymbols() {
        if (!symbolSearchQuery || symbolSearchQuery.trim() === '') {
            // If query is empty, show symbols from the selected category
            filteredSymbols = await symbolService.getSymbolsByCategory(selectedCategory);
        } else {
            // Search across all symbols
            filteredSymbols = await symbolService.searchSymbols(symbolSearchQuery);
        }
    }
    
    // Handle search input change
    async function handleSearchInput() {
        await searchSymbols();
    }
    
    // Update filtered symbols based on category selection and search query
    async function updateFilteredSymbols() {
        if (symbolSearchQuery && symbolSearchQuery.trim() !== '') {
            await searchSymbols();
        } else {
            if (selectedCategory === FAVORITES_CATEGORY) {
                // Load favorites
                filteredSymbols = await symbolService.getFavorites();
            } else {
                filteredSymbols = await symbolService.getSymbolsByCategory(selectedCategory);
            }
        }
    }
    
    // Select a category to filter symbols
    async function selectCategory(category) {
        selectedCategory = category;
        symbolSearchQuery = "";
        await updateFilteredSymbols();
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
    
    // Initialize symbols and categories
    async function initSymbols() {
        isLoading = true;
        try {
            // Load favorites first
            symbolService.loadFavorites();
            favoriteSymbols = await symbolService.getFavorites();
            
            // Get all available symbols
            availableSymbols = await symbolService.fetchAllSymbols();
            
            // Get categories (quote assets)
            symbolCategories = await symbolService.getCategories();
            
            // Add favorites as a special category at the beginning
            if (!symbolCategories.includes(FAVORITES_CATEGORY)) {
                symbolCategories.unshift(FAVORITES_CATEGORY);
            }
            
            // Get popular symbols
            topSymbols = await symbolService.getTopSymbols(10);
            
            // Initialize filtered symbols with selected category
            filteredSymbols = await symbolService.getSymbolsByCategory(selectedCategory);
            
            // Ensure our selected symbol exists in the list
            const symbolExists = availableSymbols.some(s => s.symbol === selectedSymbol);
            if (!symbolExists) {
                // If not, find a close match or use the first available symbol
                const matchingSymbol = availableSymbols.find(s => 
                    s.symbol.includes(selectedSymbol) || selectedSymbol.includes(s.symbol)
                );
                if (matchingSymbol) {
                    selectedSymbol = matchingSymbol.symbol;
                    lastValidSymbol = selectedSymbol;
                }
            }
        } catch (error) {
            console.error("[TimeframeToolbar] Error initializing symbols:", error);
            
            // Fallback to default symbols
            filteredSymbols = [
                { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT' },
                { symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT' },
                { symbol: 'BNBUSDT', baseAsset: 'BNB', quoteAsset: 'USDT' },
                { symbol: 'XRPUSDT', baseAsset: 'XRP', quoteAsset: 'USDT' },
                { symbol: 'ADAUSDT', baseAsset: 'ADA', quoteAsset: 'USDT' },
                { symbol: 'DOGEUSDT', baseAsset: 'DOGE', quoteAsset: 'USDT' },
                { symbol: 'SOLUSDT', baseAsset: 'SOL', quoteAsset: 'USDT' }
            ];
        } finally {
            isLoading = false;
        }
    }
    
    // When component mounts, recover from localStorage if needed and start state checks
    onMount(async () => {
        // Try to recover from localStorage if there's nothing yet
        if (!selectedSymbol && localStorage.getItem('omni_currentSymbol')) {
            selectedSymbol = localStorage.getItem('omni_currentSymbol');
            lastValidSymbol = selectedSymbol;
        }
        
        if (!selectedTimeframe && localStorage.getItem('omni_currentTimeframe')) {
            selectedTimeframe = localStorage.getItem('omni_currentTimeframe');
        }
        
        // Initialize symbols
        await initSymbols();
        
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
            <div class="dropdown-menu symbol-dropdown" transition:slide={{duration: 150}}>
                <!-- Search bar -->
                <div class="search-container">
                    <input 
                        type="text" 
                        bind:this={searchInputElement}
                        bind:value={symbolSearchQuery}
                        on:input={handleSearchInput}
                        placeholder="Search..." 
                        class="symbol-search-input" 
                    />
                </div>
                
                <!-- Categories -->
                {#if !symbolSearchQuery}
                    <div class="categories-container">
                        {#each symbolCategories as category}
                            <button 
                                type="button"
                                class="category-item {selectedCategory === category ? 'active' : ''}" 
                                on:click={() => selectCategory(category)}
                            >
                                {category}
                            </button>
                        {/each}
                    </div>
                {/if}
                
                <!-- Symbol list -->
                <div class="symbols-list-container">
                    {#if isLoading}
                        <div class="loading-indicator">Loading symbols...</div>
                    {:else if filteredSymbols.length === 0}
                        <div class="no-results">
                            {selectedCategory === FAVORITES_CATEGORY ? 'No favorites added yet. Click the star icon to add favorites.' : 'No symbols found'}
                        </div>
                    {:else}
                        {#each filteredSymbols as symbol}
                            <div class="dropdown-item-wrapper">
                                <button 
                                    type="button"
                                    class="dropdown-item {selectedSymbol === symbol.symbol ? 'active' : ''}" 
                                    on:click={() => selectSymbol(symbol.symbol)}
                                >
                                    <strong>{symbol.baseAsset}</strong>
                                    <span class="quote-asset">{symbol.quoteAsset}</span>
                                </button>
                                <button
                                    type="button"
                                    class="favorite-button"
                                    on:click={(e) => toggleFavorite(symbol.symbol, e)}
                                    title={isSymbolFavorite(symbol.symbol) ? "Remove from favorites" : "Add to favorites"}
                                >
                                    <span class="favorite-star {isSymbolFavorite(symbol.symbol) ? 'active' : ''}">
                                        {isSymbolFavorite(symbol.symbol) ? '★' : '☆'}
                                    </span>
                                </button>
                            </div>
                        {/each}
                    {/if}
                </div>
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
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        overflow: hidden;
        z-index: 1000;
        min-width: 280px;
        max-height: 460px;
        display: flex;
        flex-direction: column;
    }
    
    .search-container {
        padding: 8px;
        border-bottom: 1px solid #363c4e;
    }
    
    .symbol-search-input {
        width: 100%;
        padding: 8px 10px;
        background: #1e212a;
        color: #e0e0e0;
        border: 1px solid #363c4e;
        border-radius: 4px;
        font-size: 12px;
    }
    
    .symbol-search-input:focus {
        outline: none;
        border-color: #dd9801;
    }
    
    .categories-container {
        display: flex;
        flex-wrap: wrap;
        padding: 6px;
        border-bottom: 1px solid #363c4e;
        gap: 4px;
    }
    
    .category-item {
        font-size: 11px;
        padding: 3px 8px;
        border-radius: 3px;
        background: #1e212a;
        color: #9ca3af;
        border: none;
        cursor: pointer;
        transition: background-color 0.2s, color 0.2s;
    }
    
    .category-item:hover {
        background: #363c4e;
        color: #e0e0e0;
    }
    
    .category-item.active {
        background: #dd9801;
        color: white;
    }
    
    .symbols-list-container {
        flex: 1;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #363c4e transparent;
        max-height: 350px;
    }
    
    .symbols-list-container::-webkit-scrollbar {
        width: 6px;
    }
    
    .symbols-list-container::-webkit-scrollbar-track {
        background: transparent;
    }
    
    .symbols-list-container::-webkit-scrollbar-thumb {
        background-color: #363c4e;
        border-radius: 6px;
    }
    
    .dropdown-item-wrapper {
        display: flex;
        align-items: center;
        width: 100%;
        border-bottom: 1px solid rgba(54, 60, 78, 0.4);
    }
    
    .dropdown-item {
        flex-grow: 1;
        padding: 8px 12px;
        cursor: pointer;
        color: #e0e0e0;
        font-size: 12px;
        border: none;
        background: transparent;
        text-align: left;
        display: flex;
        align-items: center;
        transition: background-color 0.2s;
    }
    
    .dropdown-item:hover, .dropdown-item.active {
        background: #363c4e;
    }
    
    .dropdown-item.active {
        background: #dd9801;
    }
    
    .quote-asset {
        margin-left: 4px;
        color: #9ca3af;
        font-size: 11px;
    }
    
    .dropdown-item.active .quote-asset {
        color: rgba(255, 255, 255, 0.8);
    }
    
    .favorite-button {
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 0 10px;
        font-size: 16px;
        color: #9ca3af;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        transition: color 0.2s;
    }
    
    .favorite-button:hover {
        color: #e0e0e0;
    }
    
    .favorite-star {
        transition: color 0.2s, transform 0.2s;
    }
    
    .favorite-star.active {
        color: #dd9801;
    }
    
    .favorite-button:hover .favorite-star {
        transform: scale(1.2);
    }
    
    .loading-indicator, .no-results {
        padding: 16px;
        text-align: center;
        color: #9ca3af;
        font-size: 12px;
    }
</style>
