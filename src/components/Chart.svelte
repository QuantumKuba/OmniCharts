<script>

// Main component combining all grids, scales, etc.
// Also, main event router, root of 'update' events

import { onMount, onDestroy, createEventDispatcher } from 'svelte'
import Cursor from '../core/cursor.js'
import DataHub from '../core/dataHub.js'
import MetaHub from '../core/metaHub.js'
import Scan from '../core/dataScanner.js'
import Events from '../core/events.js'
import Const from '../stuff/constants.js'
import Utils from '../stuff/utils.js'
import Layout from '../core/layout.js'
import Context from '../stuff/context.js'
import Pane from './Pane.svelte'
import Botbar from './Botbar.svelte'
import NoDataStub from './NoDataStub.svelte'
import Toolbar from "./Toolbar.svelte"
import TimeframeToolbar from "./TimeframeToolbar.svelte"
import Heatmap from "../core/primitives/heatmap.js"

export let props = {}
export let timeframeToolbarPosition = 'top' // top or bottom

// Configure the timeframe toolbar height to match the vertical toolbar width
const TIMEFRAME_TOOLBAR_HEIGHT = props.config ? props.config.TOOLBAR - 20 : 37;

// Getters
export function getLayout() { return layout }
export function getRange() { return range }
export function getCursor() { return cursor }

// Setters
export function setRange(val) {
    let emit = !(val.preventDefault ?? true)
    delete val.preventDefault
    Object.assign(range, val) // keeping the same ref
    onRangeChanged(range, emit)
}

export function setCursor(val) {
    let emit = !(val.preventDefault ?? true)
    delete val.preventDefault
    Object.assign(cursor, val)
    onCursorChanged(cursor, emit)
}

// Singleton instances
let hub = DataHub.instance(props.id)
let meta = MetaHub.instance(props.id)
let events = Events.instance(props.id)
let scan = Scan.instance(props.id)

scan.init(props)

let interval = scan.detectInterval()
let timeFrame = scan.getTimeframe()
let range = scan.defaultRange()
let cursor = new Cursor(meta)
let storage = {} // Storage for helper variables
let ctx = new Context(props) // For measuring text
let chartRR = 0
let layout = null

scan.calcIndexOffsets()

$:chartProps = Object.assign(
    {interval, timeFrame, range, ctx, cursor},
    props,
    // Add timeframe toolbar height to chartProps so the Layout can use it
    {timeframeToolbarHeight: TIMEFRAME_TOOLBAR_HEIGHT}
)

// Add event dispatcher to forward events to parent (App.svelte)
const dispatch = createEventDispatcher();

// EVENT INTEFACE
events.on('chart:cursor-changed', onCursorChanged)
events.on('chart:cursor-locked', onCursorLocked)
events.on('chart:range-changed', onRangeChanged)
events.on('chart:update-layout', update)
events.on('chart:full-update', fullUpdate)
events.on('chart:symbol-changed', onSymbolChanged)

onMount(() => {
    hub.calcSubset(range)
    hub.detectMain()
    hub.loadScripts(range, scan.tf, true)
    meta.init(props)

    scan.updatePanesHash()

    layout = new Layout(chartProps, hub, meta);

    // console.log(layout) // DEBUG
})

onDestroy(() => {
    console.log('destroyHeatmap');
    // Clean-up event listeners on 'chart' component
    meta.destroyHeatmap();
    events.off('chart')
})

// Add handler for TimeframeToolbar's symbolSelected event
function handleSymbolSelected(event) {
    // Forward the event up to App.svelte
    dispatch('symbolSelected', event.detail);
}

function onCursorChanged($cursor, emit = true) {
    // Emit a global event (hook)
    if ($cursor.mode) cursor.mode = $cursor.mode
    if (cursor.mode !== 'explore') {
        cursor.xSync(hub, layout, chartProps, $cursor)
        if ($cursor.visible === false) {
            // One more update to hide the cursor
            setTimeout(() => update())
        }
    }
    if (emit) events.emit('$cursor-update',
        Utils.makeCursorEvent($cursor, cursor, layout)
    )
    //if (cursor.locked) return // filter double updates (*)
    update()
}

function onCursorLocked(state) {
    if (cursor.scrollLock && state) return
    cursor.locked = state
}

// TODO: init cursor when trackpad scrolling
// is the first input (no mousemove yet)
function onRangeChanged($range, emit = true) {
    // Emit a global event (hook)
    if (emit) events.emit('$range-update', $range)
    rangeUpdate($range)
    hub.updateRange(range)
    // TODO: Shoud be enabled (*), but it creates cursor lag
    if (cursor.locked) return // filter double updates (**)
    cursor.xValues(hub, layout, chartProps)
    cursor.yValues(layout)
    update()
    // Quantize cursor after events stop coming in
    let Q = props.config.QUANTIZE_AFTER
    if (Q) Utils.afterAll(storage, quantizeCursor, Q)
}

function quantizeCursor() {
    cursor.xSync(hub, layout, chartProps, cursor)
    update()
}

function update(opt = {}, emit = true) {
    // Emit a global event (hook)
    if (emit) events.emit('$chart-pre-update')
    //Utils.callsPerSecond()
    // If we changed UUIDs of but don't want to trigger
    // the full update, we need to set updateHash:true
    if (opt.updateHash) scan.updatePanesHash()
    if (scan.panesChanged()) return fullUpdate(opt)
    cursor = cursor // Trigger Svelte update
    layout = new Layout(chartProps, hub, meta)
    events.emit('update-pane', layout) // Update all panes
    events.emitSpec('botbar', 'update-bb', layout)
    if (emit) events.emit('$chart-update')
}

// Full update when the dataset changed completely
// or the list of panes/overlays is changed
// TODO: we can update only panes with
// overlay changes. But it requires more work
function fullUpdate(opt = {}) {
    let prevIbMode = scan.ibMode
    interval = scan.detectInterval()
    timeFrame = scan.getTimeframe()
    let ibc = scan.ibMode !== prevIbMode
    if (!range.length || opt.resetRange || ibc) {
        rangeUpdate(scan.defaultRange())
    }
    scan.calcIndexOffsets()
    hub.calcSubset(range)
    hub.init(hub.data)
    hub.detectMain()
    // TODO: exec only if scripts changed
    hub.loadScripts()
    meta.init(props)
    meta.restore()
    scan.updatePanesHash()
    update()
    events.emit('remake-grid')
}

// Instant range update
function rangeUpdate($range) {
    range = $range
    chartProps.range = range // Instant update
}

// Handler for symbol/timeframe changes - forces a complete redraw
function onSymbolChanged() {
    // Save the current tool state before resetting
    const currentTool = meta.tool;
    const currentSelectedTool = meta.selectedTool;
    const currentDrawingMode = meta.drawingMode;
    const currentMagnet = meta.magnet;
    
    // Increment chartRR to force a complete component redraw
    chartRR++;
    
    // Reset meta but preserve specific tool states
    meta.yTransforms = [];
    meta.storage = {};
    meta.init(props);
    
    // Restore tool states
    meta.tool = currentTool;
    meta.selectedTool = currentSelectedTool;
    meta.drawingMode = currentDrawingMode;
    meta.magnet = currentMagnet;
    
    // Completely rebuild the layout
    layout = new Layout(chartProps, hub, meta);
    
    // Reset and update all components
    events.emit('remake-grid');
    
    // Force sidebar and toolbar updates
    setTimeout(() => {
        // Update sidebars
        const sidebars = document.querySelectorAll('.nvjs-sidebar');
        sidebars.forEach(sidebar => {
            const id = sidebar.id.split('-')[2]; // Extract pane ID
            const side = sidebar.id.split('-')[4]; // Extract side (left/right)
            events.emitSpec(`sb-${id}-${side}`, 'symbol-changed');
            events.emitSpec(`sb-${id}-${side}`, 'update-sb', layout);
        });
        
        // Update toolbar and drawing tools state
        events.emit('toolbar:refresh');
        
        // Ensure active tool is still selected in toolbar
        if (currentTool && currentTool !== 'Cursor') {
            events.emit('meta:tool-selected', { type: currentTool });
        }
    }, 50);
}

</script>
<style>

    /* Chart container styles NOTE: commented out as its not needed */
    .nvjs-chart {
        position: relative;
        height: 100%;
        width: 100%;
        overflow: hidden;
        background-color: var(--back-color, #14151c);
    }
    
    /* The main chart content needs top padding to avoid overlapping with the timeframe toolbar */
     .chart-content {
        position: absolute;
        top: 37px; /* Match the timeframe toolbar height */
        left: 0;
        right: 0;
        bottom: 0;
    } 
</style>

{#key chartRR} <!-- Full chart re-render -->
<div class="nvjs-chart">
    {#if layout && layout.main}
        <TimeframeToolbar {props} on:symbolSelected={handleSymbolSelected} />
        
        <div class="chart-content">
            <Toolbar {props} side='left'/>

            {#each hub.panes() as pane, i}
            <Pane id={i}
                layout={layout.grids[i]}
                props={chartProps}
            />
            {/each}
            <Botbar props={chartProps} {layout}/>
        </div>
    {:else}
        <NoDataStub {props}/>
    {/if}
</div>
{/key}
