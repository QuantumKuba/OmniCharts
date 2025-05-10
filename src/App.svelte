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
    let activeIndicators = {}; // Store active indicators by symbol

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

    // Add this utility function before the reloadData function
    function addIndicatorToChart(chart, indicatorName, settings = {}, props = {}) {
        try {
            // Based on how indicators are properly added in NightVision
            if (!chart || !chart.data || !chart.data.panes) {
                console.error('Chart not properly initialized');
                return false;
            }
            
            // Find the first available pane or create a new one based on indicator type
            let paneIndex = 0;
            let isOverlayIndicator = ['BB', 'EMA', 'SMA', 'ALMA', 'VWMA', 'SWMA', 'KC'].includes(indicatorName);
            
            if (!isOverlayIndicator) {
                // For indicators that go in their own pane, use the second pane or create it
                if (chart.data.panes.length < 2) {
                    // Create a second pane for the indicator
                    chart.data.panes.push({
                        overlays: []
                    });
                }
                paneIndex = 1;
            }
            
            // Create the indicator overlay with the proper script reference
            const overlay = {
                name: `${indicatorName}`,
                type: 'Script', // Important! NightVision script type
                data: [], // Will be filled by the script engine
                settings: Object.assign({
                    script: indicatorName, // Reference to the .navy script
                    precision: 2
                }, settings),
                props: props || {}
            };
            
            console.log(`Adding indicator ${indicatorName} to pane ${paneIndex}`, overlay);
            
            // Add the overlay to the appropriate pane
            chart.data.panes[paneIndex].overlays.push(overlay);
            
            // Update the chart and execute scripts
            chart.update("full");  // Full update to ensure proper initialization
            chart.se.uploadAndExec();
            
            return true;
        } catch (e) {
            console.error(`Error adding indicator ${indicatorName}:`, e);
            return false;
        }
    }

    // Function to reload data based on the selected symbol and timeframe
    function reloadData() {
        if (!dl) {
            console.error("DataLoader is not initialized.");
            return;
        }
        
        console.log(
            `Reloading data for symbol: ${currentSymbol} with timeframe: ${dl.TF}`,
        );
        
        // Save the current chart's indicators before changing symbols
        if (chart && chart.hub) {
            // Create a deep copy of the chart's panes structure
            const savedIndicators = [];
            
            // Check if hub.panes is an array or a function that returns an array
            const panes = typeof chart.hub.panes === 'function' ? chart.hub.panes() : 
                         (Array.isArray(chart.hub.panes) ? chart.hub.panes : []);
            
            // Go through each pane and find indicator overlays
            panes.forEach(pane => {
                if (!pane.overlays) return;
                
                pane.overlays.forEach(overlay => {
                    // Skip the main price overlay
                    if (overlay.main) return;
                    // Only save script-type overlays (skip drawing tools)
                    if (overlay.type !== 'Script') return;
                    // Save non-main overlays (indicators)
                    savedIndicators.push({
                        name: overlay.name,
                        // For Script type, use the script name from settings, otherwise use the type
                        type: overlay.type === 'Script' && overlay.settings && overlay.settings.script ? 
                              overlay.settings.script : overlay.type,
                        settings: JSON.parse(JSON.stringify(overlay.settings || {})),
                        props: JSON.parse(JSON.stringify(overlay.props || {}))
                    });
                });
            });
            
            // Store the indicators for this symbol
            if (savedIndicators.length > 0) {
                activeIndicators[currentSymbol] = savedIndicators;
                console.log(`Saved ${savedIndicators.length} indicators for ${currentSymbol}`);
            }
        }
        
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
            
            // Ensure the tools array is preserved from the original data
            if (!newData.tools && chart.data && chart.data.tools) {
                newData.tools = chart.data.tools;
            }
            
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
                
                // Make sure each pane has the drawing tools
                newData.panes.forEach((pane, paneIndex) => {
                    if (!pane.settings) pane.settings = {};
                    
                    // Clear any stored scale settings to ensure fresh scaling
                    pane.settings.scales = {};
                    
                    // Ensure drawing tools are preserved in each pane
                    const drawingTools = [
                        {
                            name: "RangeTool",
                            type: "RangeTool",
                            drawingTool: true,
                            data: [],
                            props: {},
                            settings: {
                                zIndex: 1000,
                            },
                        },
                        {
                            name: "LineTool",
                            type: "LineTool",
                            drawingTool: true,
                            data: [],
                            props: {},
                            settings: {
                                zIndex: 1000,
                            },
                        },
                        {
                            name: "LineToolHorizontalRay",
                            type: "LineToolHorizontalRay",
                            drawingTool: true,
                            data: [],
                            props: {},
                            settings: {
                                zIndex: 1000,
                            },
                        },
                        {
                            name: "Brush",
                            type: "Brush",
                            drawingTool: true,
                            data: [],
                            props: {},
                            settings: {
                                zIndex: 1000,
                            },
                        }
                    ];
                    
                    // Add drawing tools if they don't exist
                    drawingTools.forEach(tool => {
                        if (!pane.overlays.some(o => o.type === tool.type)) {
                            pane.overlays.push(tool);
                        }
                    });
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
                    indexBased: false,
                    onSymbolTimeframeChange: handleSymbolChange
                });
                // Reset and render new data immediately
                chart.fullReset();

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
                    
                    try {
                        await chart.se.updateData();
                    } catch (e) {
                        console.error("Error updating script engine data:", e);
                    }
                    
                    // Guard against potential null values after async operation
                    const dataSubsetLength = chart.hub.mainOv?.dataSubset?.length || 0;
                    var delay = dataSubsetLength < 1000 ? 10 : 1000; // Floating update rate
                    
                    setTimeout(update, delay);
                }
                
                // Use the global loadMore function for range updates
                chart.events.on("app:$range-update", window.loadMore || loadMore);
                // Immediately prime one historical load so indicators have data
                setTimeout(() => window.loadMore(), 100);
                // Auto prime history for indicators by directly loading one batch
                setTimeout(() => {
                    const mainOv = chart.hub.mainOv;
                    if (mainOv && mainOv.data && mainOv.data.length && dl) {
                        const oldest = mainOv.data[0][0];
                        console.log(`Auto priming historical candles before ${new Date(oldest).toISOString()}`);
                        dl.loadMore(oldest - 1, (chunk) => {
                            if (chunk && chunk.length) {
                                mainOv.data.unshift(...chunk);
                                chart.update("data");
                                chart.se.uploadAndExec();
                            }
                        });
                    }
                }, 200);

                // Make sure scripts are properly loaded and executed
                // for indicators to work correctly
                try {
                    // Apply any default indicators
                    if (indicators) {
                        console.log("Applying default indicators");
                        indicators(stack, chart);
                        
                        // After a short delay, restore saved indicators for this symbol if they exist
                        setTimeout(() => {
                            if (activeIndicators[currentSymbol] && activeIndicators[currentSymbol].length > 0) {
                                console.log(`Restoring ${activeIndicators[currentSymbol].length} indicators for ${currentSymbol}`);
                                
                                // Restore each saved indicator using our utility function
                                activeIndicators[currentSymbol].forEach(indData => {
                                    addIndicatorToChart(chart, indData.type, indData.settings, indData.props);
                                    console.log(`Restored indicator: ${indData.name}`);
                                });
                                
                                // Update and execute scripts after adding indicators
                                chart.update("data");
                                chart.se.uploadAndExec();
                            }
                        }, 500);
                    }
                    
                    // Execute scripts (important for indicators)
                    chart.se.uploadAndExec();
                } catch (e) {
                    console.error("Error initializing indicators:", e);
                }
                
                // Re-establish the global reference
                window.chart = chart;
                
                // Start the update loop
                setTimeout(update, 100);
                
                // Allow a brief delay before initializing the WebSocket with the CURRENT symbol
                // This is crucial - we need to use the current symbol's value, not rely on
                // the symbol stored in dl.SYM which might be incorrect
                setTimeout(() => {
                    try {
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
                    } catch (e) {
                        console.error("Error initializing WebSocket:", e);
                    }
                }, 1000); // Increased delay to ensure chart is fully initialized

                // Trigger initial historical data load for indicators
                setTimeout(() => {
                    console.log('Priming historical data load');
                    window.loadMore();
                }, 1500);
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
            // Pass the event handler to the NightVision instance
            onSymbolTimeframeChange: handleSymbolChange
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

        // Make sure the chart instance has access to the handler
        chart.events.on('chart-symbolTimeframe-changed', handleSymbolChange);

        // Expose the objects to the global scope for debugging
        window.wsx = wsx;
        window.chart = chart;
        window.stack = stack;
        // Expose the symbol change handler so it can be called from TimeframeToolbar
        window.handleSymbolChange = handleSymbolChange;

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
