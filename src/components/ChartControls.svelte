<script>
    import { onMount } from 'svelte';
    import Events from '../core/events.js';
    import MetaHub from '../core/metaHub.js';
    import DataHub from '../core/dataHub.js'; // For clearing local drawings after reset
    import { resetChartState } from '../services/chartStateService.js';

    export let props = {}; // Assuming chart ID might be in props.id

    let events = Events.instance(props.id);
    let meta = MetaHub.instance(props.id);
    let hub = DataHub.instance(props.id);

    function getCurrentSymbolTimeframeFromProps() {
        const chartProps = props.chartProps || (props.parent && props.parent.chartProps) || {};
        const symbol = chartProps.symbol || (props.data && props.data.chart && props.data.chart.symbol);
        const timeframe = chartProps.timeFrame;
        
        if (!symbol || !timeframe) {
            console.warn("ChartControls: Symbol or timeframe not available. Attempting to get from MetaHub/Scan if possible.");
            return null;
        }
        return { symbol, timeframe };
    }

    let areDrawingsVisible = true; 

    onMount(() => {
        if (typeof meta.areDrawingsVisible === 'boolean') {
            areDrawingsVisible = meta.areDrawingsVisible;
        } else {
            meta.areDrawingsVisible = areDrawingsVisible; 
        }
    });

    function toggleDrawingsVisibility() {
        areDrawingsVisible = !areDrawingsVisible;
        meta.areDrawingsVisible = areDrawingsVisible; 
        events.emit('drawing:visibility-changed', { visible: areDrawingsVisible });
        events.emitSpec('chart', 'update-layout'); 
        console.log(`Drawings visibility toggled to: ${areDrawingsVisible}`);
    }

    async function handleResetDrawings() {
        const st = getCurrentSymbolTimeframeFromProps();
        if (!st) {
            alert("Cannot determine symbol/timeframe to reset drawings. Ensure chartProps are passed correctly.");
            return;
        }
        const { symbol, timeframe } = st;

        // if (confirm(`Are you sure you want to reset all drawings and signals for ${symbol} on ${timeframe}? This cannot be undone.`)) { // Temporarily commented for testing
            try {
                await resetChartState(symbol, timeframe);
                for (const pane of hub.data.panes) {
                    if (pane.overlays) {
                        pane.overlays = pane.overlays.filter(ov => !ov.drawingTool);
                    }
                }
                events.emitSpec('chart', 'full-update', { resetRange: false }); 
                alert(`Drawings for ${symbol}/${timeframe} have been reset.`); // This alert will also block Puppeteer
            } catch (error) {
                console.error("Failed to reset chart state:", error);
                alert("Error resetting drawings. See console for details."); // This alert will also block Puppeteer
            }
        // } // Temporarily commented for testing
    }

    const buttonStyle = "padding: 5px 10px; margin: 5px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; background-color: #f9f9f9;";
</script>

<div class="chart-controls-toolbar" style="position: absolute; top: 10px; right: 60px; z-index: 1001; background: rgba(255,255,255,0.9); padding: 5px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
    <button style="{buttonStyle}" on:click={toggleDrawingsVisibility} title="Toggle visibility of all drawings">
        {areDrawingsVisible ? 'Hide' : 'Show'} Drawings
    </button>
    <button style="{buttonStyle}" on:click={handleResetDrawings} title="Delete all drawings and signals for this chart from the server">
        Reset All Chart Drawings
    </button>
</div>

<style>
    .chart-controls-toolbar button:hover {
        background-color: #e0e0e0;
        border-color: #bbb;
    }
    .chart-controls-toolbar button {
        transition: background-color 0.15s ease-in-out, border-color 0.15s ease-in-out;
    }
</style>
