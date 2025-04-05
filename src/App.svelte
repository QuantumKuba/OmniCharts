<!-- App.svelte -->
<script>
    import { NightVision } from "./index.js";
    import { onMount } from "svelte";

    import TestStack from "../tests/testStack.js";

    // Import various test suites
    import fullReset from "../tests/data-sync/fullReset.js";
    import paneAddRem from "../tests/data-sync/paneAddRem.js";
    import paneSettings from "../tests/data-sync/paneSettings.js";
    import ovAddRem from "../tests/data-sync/ovAddRem.js";
    import scaleChange from "../tests/data-sync/scaleChange.js";
    import mainOverlay from "../tests/data-sync/mainOverlay.js";
    import ovSettings from "../tests/data-sync/ovSettings.js";
    import ovPropsChange from "../tests/data-sync/ovPropsChange.js";
    import ovDataChange from "../tests/data-sync/ovDataChange.js";

    import realTime from "../tests/real-time/realTime.js";
    import timeBased from "../tests/tfs-test/allTimeBased.js";
    import indexBased from "../tests/tfs-test/allIndexBased.js";
    import indicators from "../tests/indicators/indicators.js";
    import rangeTool from "../tests/tools/rangeTool.js";
    import lineTool from "../tests/tools/lineTool.js";
    import watchPropTest from "../tests/navy/watchPropTest.js";
    import logScaleTest from "../tests/scales/logScale.js";
    import memoryTest from "../tests/memory/memoryTest.js";

    import { DataLoader } from "../tests/real-time/lib/dataLoader.js";
    import wsx from "../tests/real-time/lib/wsx.js";
    import sampler from "../tests/real-time/lib/ohlcvSampler.js";
    import { tfToMs } from "../tests/real-time/lib/timeframeUtils.js";

    import heatmapScript from "./scripts/heatmap.navy";
    import ZLEMA from "./scripts/indicators/ZLEMA.navy";
    import SymbolSidebar from "./components/SymbolSidebar.svelte";

    // Initialize the test stack and charting instance
    let stack = new TestStack();
    let chart = null;
    let data = [];
    let dl = null; // Global DataLoader variable
    let currentSymbol = "BTCUSDT";
    let currentTimeframe = "5m"; // Default timeframe

    // Handle symbol and timeframe selection from the sidebar
    const handleSymbolChange = (event) => {
        const { symbol, timeframe } = event.detail;
        currentSymbol = symbol;
        currentTimeframe = timeframe;
        if (dl) {
            dl.SYM = currentSymbol;
            dl.TF = currentTimeframe; // Update the timeframe
            reloadData();
        } else {
            console.error("DataLoader is not initialized.");
        }
    };

    // Function to reload data based on the selected symbol and timeframe
    function reloadData() {
        if (!dl) {
            console.error("DataLoader is not initialized.");
            return;
        }
        
        console.log(
            `Reloading data for symbol: ${currentSymbol} with timeframe: ${dl.TF}`,
        );
        
        // Stop any ongoing WebSocket updates before changing symbol
        if (wsx) {
            wsx.terminate(); // Properly terminate WebSocket connection
        }
        
        // Clear the chart with an empty structure
        chart.data = {
            panes: [] // Empty panes array ensures it's iterable
        };
        
        // Load the initial data for the new symbol and timeframe
        dl.load((newData) => {
            console.log(
                `Data loaded for symbol: ${currentSymbol} with timeframe: ${dl.TF}`,
            );
            
            // Update data with the symbol name in the main overlay
            if (newData.panes && newData.panes.length > 0 && 
                newData.panes[0].overlays && newData.panes[0].overlays.length > 0) {
                
                // Update the name of the main overlay to reflect current symbol
                const mainOverlay = newData.panes[0].overlays.find(o => o.main);
                if (mainOverlay) {
                    mainOverlay.name = `${currentSymbol} / Tether US`;
                    
                    // Force auto-scaling for the new price range
                    if (!mainOverlay.settings) mainOverlay.settings = {};
                    mainOverlay.settings.autoScale = true;
                }
                
                // Reset scales in all panes
                newData.panes.forEach(pane => {
                    if (!pane.settings) pane.settings = {};
                    
                    // Clear any stored scale settings to ensure fresh scaling
                    pane.settings.scales = {};
                });
            }
            
            // Create a fresh chart instance
            const container = document.getElementById('chart-container');
            if (container) {
                // Clear the container
                container.innerHTML = '';
                
                // Create a new NightVision instance
                chart = new NightVision("chart-container", {
                    data: newData,
                    autoResize: true,
                    indexBased: false
                });
                
                // Re-define the update function
                async function update() {
                    if (!chart.hub.mainOv) {
                        setTimeout(update, 100); // Retry after a short delay
                        return;
                    }
                    
                    // Add additional check to prevent the error when dataSubset is null
                    if (!chart.hub.mainOv.dataSubset) {
                        setTimeout(update, 100); // Retry after a short delay
                        return;
                    }
                    
                    await chart.se.updateData();
                    
                    // Guard against potential null values after async operation
                    const dataSubsetLength = chart.hub.mainOv?.dataSubset?.length || 0;
                    var delay = dataSubsetLength < 1000 ? 10 : 1000; // Floating update rate
                    
                    setTimeout(update, delay);
                }
                
                // Use the global loadMore function for range updates
                chart.events.on("app:$range-update", window.loadMore || loadMore);
                
                // Execute scripts
                chart.se.uploadAndExec();
                
                // Re-establish the global reference
                window.chart = chart;
                
                // Start the update loop
                setTimeout(update, 100);
                
                // Allow a brief delay before initializing the WebSocket with the CURRENT symbol
                // This is crucial - we need to use the current symbol's value, not rely on
                // the symbol stored in dl.SYM which might be incorrect
                setTimeout(() => {
                    // Explicitly initialize WebSocket with the current symbol
                    console.log(`Initializing WebSocket for symbol: ${currentSymbol}`);
                    wsx.init([currentSymbol]);
                    
                    // Re-establish the trade handling
                    wsx.ontrades = (d) => {
                        if (!chart.hub.mainOv) return;
                        let data = chart.hub.mainOv.data;
                        let trade = {
                            price: d.price,
                            volume: d.price * d.size,
                        };
                        
                        // Convert the current timeframe string to milliseconds
                        const tfMs = tfToMs(currentTimeframe);
                        
                        // Pass the correct timeframe in milliseconds to the sampler
                        if (sampler(data, trade, tfMs)) {
                            chart.update("data"); // New candle
                            chart.scroll(); // Scroll forward
                        }
                    };
                }, 500);
            }
        });
    }

    onMount(() => {
        /**
         * Initialize the NightVision chart and data loader on component mount
         */
        chart = new NightVision("chart-container", {
            data: data,
            autoResize: true,
            indexBased: false,
            // timeframe: currentTimeframe, // Pass timeframe if required by the library
        });

        // Initialize DataLoader with symbol and timeframe
        dl = new DataLoader(currentSymbol, currentTimeframe);
        console.log(
            `DataLoader initialized for symbol: ${currentSymbol} with timeframe: ${currentTimeframe}`,
        );

        // Load the initial data
        dl.load((initialData) => {
            console.log(
                `Initial data loaded for symbol: ${currentSymbol} with timeframe: ${dl.TF}`,
            );
            chart.data = initialData;
            chart.fullReset();
            chart.se.uploadAndExec();
        });

        /**
         * Function to load more data as the user scrolls left or more data becomes available
         */
        function loadMore() {
            if (!chart.hub.mainOv) {
                setTimeout(loadMore, 100); // Retry after a short delay
                return;
            }
            
            let data = chart.hub.mainOv.data;
            if (!data || data.length === 0) return;
            
            let t0 = data[0][0];
            if (chart.range[0] < t0) {
                console.log(`Requesting historical data before ${new Date(t0).toISOString()}`);
                
                dl.loadMore(t0 - 1, (chunk) => {
                    if (chunk && chunk.length > 0) {
                        console.log(`Adding ${chunk.length} historical candles to chart`);
                        // Prepend a new chunk at the beginning
                        data.unshift(...chunk);
                        chart.update("data"); // Update the chart
                        chart.se.uploadAndExec(); // Execute the scripts through ScriptEngine
                    } else {
                        console.warn("No historical data received to load");
                    }
                });
            }
        }

        // Only define loadMore once - remove the duplicate definition in reloadData
        window.loadMore = loadMore; // Make it available globally for debugging

        /**
         * Updates the chart's script engine periodically based on the data subset size.
         */
        async function update() {
            if (!chart.hub.mainOv) {
                setTimeout(update, 100); // Retry after a short delay
                return;
            }
            
            // Add additional check to prevent the error when dataSubset is null
            if (!chart.hub.mainOv.dataSubset) {
                setTimeout(update, 100); // Retry after a short delay
                return;
            }
            
            await chart.se.updateData();
            
            // Guard against potential null values after async operation
            const dataSubsetLength = chart.hub.mainOv?.dataSubset?.length || 0;
            var delay = dataSubsetLength < 1000 ? 10 : 1000; // Floating update rate
            
            setTimeout(update, delay);
        }

        // Load new data when user scrolls left
        chart.events.on("app:$range-update", loadMore);

        // Check for updates periodically but less frequently to avoid API rate limits
        setInterval(loadMore, 2000);

        // TA + chart update loop
        setTimeout(update, 0);

        /**
         * Sets up a trade data stream and updates the chart with new trade information.
         */
        wsx.init([dl.SYM]);
        wsx.ontrades = (d) => {
            if (!chart.hub.mainOv) return;
            let data = chart.hub.mainOv.data;
            let trade = {
                price: d.price,
                volume: d.price * d.size,
            };
            
            // Convert the current timeframe string to milliseconds
            const tfMs = tfToMs(currentTimeframe);
            
            // Pass the correct timeframe in milliseconds to the sampler
            if (sampler(data, trade, tfMs)) {
                chart.update("data"); // New candle
                chart.scroll(); // Scroll forward
            }
        };

        // Expose the objects to the global scope for debugging
        window.wsx = wsx;
        window.chart = chart;
        window.stack = stack;

        // Group and execute test suites
        stack.setGroup("data-sync");
        fullReset(stack, chart);
        paneAddRem(stack, chart);
        paneSettings(stack, chart);
        ovAddRem(stack, chart);
        scaleChange(stack, chart);
        mainOverlay(stack, chart);
        ovSettings(stack, chart);
        ovPropsChange(stack, chart);
        ovDataChange(stack, chart);

        stack.setGroup("real-time");

        realTime(stack, chart);

        stack.setGroup("tfs-test");

        timeBased(stack, chart);
        indexBased(stack, chart);

        stack.setGroup("ind-test");

        indicators(stack, chart);

        stack.setGroup("tools-test");

        //rangeTool(stack, chart)
        lineTool(stack, chart);

        stack.setGroup("navy-test");

        watchPropTest(stack, chart);

        stack.setGroup("scales-test");

        logScaleTest(stack, chart);

        stack.setGroup("memory-test");

        memoryTest(stack, chart);

        //  Type in the console: stack.execAll()
        //  or: stack.exec('<group>')
    });
</script>

<div class="app">
    <div id="chart-container"></div>
    <SymbolSidebar on:symbolSelected={handleSymbolChange} />
</div>

<style>
    .app {
        display: flex;
        height: 100vh;
        width: 100vw;
        position: relative;
    }

    #chart-container {
        position: absolute;
        width: 100%;
        height: 100%;
        z-index: 500; /* Ensures chart is below the sidebar */
    }
</style>
