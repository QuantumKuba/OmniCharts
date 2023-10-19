// Container for y-transforms, meta functions, other info
// about overlays (e.g. yRange)

import Utils from '../stuff/utils.js'
import Events from './events.js'
import DataHub from './dataHub.js'
import Keys from "../stuff/keys.js";

class MetaHub {

    constructor(nvId) {

        let events = Events.instance(nvId);
        this.hub = DataHub.instance(nvId)
        this.events = events

        // EVENT INTERFACE
        events.on('meta:sidebar-transform', this.onYTransform.bind(this))
        events.on('meta:select-overlay', this.onOverlaySelect.bind(this))
        events.on('meta:grid-mousedown', this.onGridMousedown.bind(this))
        events.on('meta:scroll-lock', this.onScrollLock.bind(this))
        events.on('meta:tool-selected', this.toolSelected.bind(this));
        events.on('meta:drawing-mode-off', this.drawingModeOff.bind(this));
        events.on('meta:change-tool-settings', this.changeToolSettings.bind(this));
        events.on('meta:object-selected', this.objectSelected.bind(this));
        events.on('meta:remove-all-tools', this.removeAllTools.bind(this));

        document.addEventListener('keydown', ({key}) => key === 'Delete' || key === 'Backspace' ? this.removeTool() : void 0);
        document.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });

        // Persistent meta storage
        this.storage = {};

        this.tool = 'Cursor';
        this.drawingMode = false;
        this.selectedTool = undefined;
    }

    init(props) {
        this.panes = 0 // Panes processed
        this.ready = false
        // [API] read-only
        this.legendFns = [] // Legend formatters
        this.yTransforms = [] // yTransforms of sidebars
        this.preSamplers = [] // Auto-precision samplers
        this.yRangeFns = [] // yRange functions of overlays
        this.autoPrecisions = [] // Auto-precision for overlays
        this.valueTrackers = [] // Price labels + price lines
        // TODO: legend formatters ...
        // TODO: last values
        this.selectedOverlay = undefined
        /* OHLC Map format: {
            timestamp: {
                ref: [], // Reference to n-th data item
                index: n // Item global index
            }, ...
        }*/
        this.ohlcMap = [] // time => OHLC map of the main ov
        this.ohlcFn = undefined // OHLC mapper function
        this.scrollLock = false // Scroll lock state
    }

    // User tapped grid (& deselected all overlays)
    onGridMousedown(event) {
        this.objectSelected({id: undefined});

        if (event[1].shiftKey) {
            this.events.emit('tool-selected', {type: 'RangeTool', props: {shiftMode: true, initYPos: event[1].layerY}});
            return void 0;
        }

        if (event[1].which === 3) {
            this.events.emit('tool-selected', {type: 'LineToolHorizontalRay'});
        }

        if (!this.drawingMode && this.tool === 'Cursor') {
            this.removeRangeTool();
        }

        this.selectedOverlay = undefined
        this.events.emit('$overlay-select', {
            index: undefined,
            ov: undefined
        });
    }

    objectSelected = ({id}) => {
        this.selectedTool = id;
    }

    removeAllTools = () => {
        const drawingOverlayIndexes = this.hub.data.panes[0].overlays.map((overlay, idx) => overlay.drawingTool ? idx : undefined).filter(Boolean);
        if (drawingOverlayIndexes.length) {
            this.hub.data.panes[0].overlays = this.hub.data.panes[0].overlays.filter((overlay, idx) => !drawingOverlayIndexes.includes(idx));
        }
        this.selectedTool = undefined;
        this.tool = undefined;
        this.drawingModeOff();
        this.events.emitSpec('chart', 'update-layout');
    }

    removeTool = () => {
        this.removeDrawingOverlayTool(this.selectedTool);
        this.selectedTool = undefined;
        this.tool = undefined;
        this.drawingModeOff();

        this.events.emitSpec('chart', 'update-layout');
    }

    changeToolSettings = (event) => {
        this.updateToolSettings(event);
    }

    drawingModeOff = () => {
        this.tool = 'Cursor';
        this.drawingMode = false;
    }

    toolSelected = (event) => {
        if (this.drawingMode) {
            return void 0;
        }

        this.tool = event.type;
        this.drawingMode = event.type !== 'Cursor';
        this.buildTool(event.props);
    }

    buildTool = (props = {}) => {
        this.hub.data.panes[0].overlays.push({
            name: this.tool + Math.random(),
            type: this.tool,
            id: Math.random(),
            drawingTool: true,
            data: [[]],
            props: props,
            settings: {
                zIndex: 0
            }
        });
    }

    updateToolSettings = ({id, pins}) => {
        const toolIdx = this.hub.data.panes[0].overlays.findIndex((overlay) => overlay.id === id);
        if (toolIdx !== -1) {
            this.hub.data.panes[0].overlays[toolIdx].props = {pins};
        }

        this.events.emit('commit-tool-changes');
    }

    removeDrawingOverlayTool = (toolId) => {
        const drawingOverlayIdx = this.hub.data.panes[0].overlays.findIndex((overlay) => toolId === overlay.id);
        if (drawingOverlayIdx !== -1) {
            this.hub.data.panes[0].overlays.splice(drawingOverlayIdx, 1);
        }
    }

    removeRangeTool = () => {
        const drawingOverlayIdx = this.hub.data.panes[0].overlays.findIndex((overlay) => overlay.type === 'RangeTool');
        if (drawingOverlayIdx !== -1) {
            this.hub.data.panes[0].overlays.splice(drawingOverlayIdx, 1);
        }
    }

    // Extract meta functions from overlay
    exctractFrom(overlay) {
        let gridId = overlay.gridId()
        let id = overlay.id()

        // yRange functions
        var yrfs = this.yRangeFns[gridId] || []
        yrfs[id] = overlay.yRange ? {
            exec: overlay.yRange,
            preCalc: overlay.yRangePreCalc
        } : null

        // Precision samplers
        var aps = this.preSamplers[gridId] || []
        aps[id] = overlay.preSampler

        // Legend formatters
        var lfs = this.legendFns[gridId] || []
        lfs[id] = {
            legend: overlay.legend,
            legendHtml: overlay.legendHtml,
            noLegend: overlay.noLegend ?? false
        }

        // Value trackers
        var vts = this.valueTrackers[gridId] || []
        vts[id] = overlay.valueTracker

        // Ohlc mapper function
        let main = this.hub.overlay(gridId, id).main
        if (main) {
            this.ohlcFn = overlay.ohlc
        }

        this.yRangeFns[gridId] = yrfs
        this.preSamplers[gridId] = aps
        this.legendFns[gridId] = lfs
        this.valueTrackers[gridId] = vts

    }

    // Maps timestamp => ohlc, index
    // TODO: should add support for indexBased? 
    calcOhlcMap() {
        this.ohlcMap = {}
        let data = this.hub.mainOv.data
        for (var i = 0; i < data.length; i++) {
            this.ohlcMap[data[i][0]] = {
                ref: data[i],
                index: i
            }
        }
    }

    // Store auto precision for a specific overlay
    setAutoPrec(gridId, ovId, prec) {
        let aps = this.autoPrecisions[gridId] || []
        aps[ovId] = prec
        this.autoPrecisions[gridId] = aps
    }

    // Call this after all overlays are processed
    // We need to make an update to apply freshly
    // extracted functions
    // TODO: probably can do better
    finish() {
        this.panes++
        if (this.panes < this.hub.panes().length) return
        this.autoPrecisions = [] // wait for preSamplers
        //this.restore()
        this.calcOhlcMap()
        this.ready = true
        setTimeout(() => {
            this.events.emitSpec('chart', 'update-layout')
            this.events.emit('update-legend')
        })
    }

    // Store some meta info such as ytransform by
    // (pane.uuid + scaleId) hash
    store() {
        this.storage = {}
        let yts = this.yTransforms || []
        for (var paneId in yts) {
            let paneYts = yts[paneId]
            let pane = this.hub.panes()[paneId]
            if (!pane) continue
            for (var scaleId in paneYts) {
                let hash = `yts:${pane.uuid}:${scaleId}`
                this.storage[hash] = paneYts[scaleId]
            }
        }

    }

    // Restore that info after an update in the
    // pane/overlay order
    restore() {
        let yts = this.yTransforms
        for (var hash in this.storage) {
            let [type, uuid1, uuid2] = hash.split(':')
            let pane = this.hub.panes().find(x => x.uuid === uuid1)
            if (!pane) continue
            switch (type) {
                case 'yts': // Y-transforms
                    if (!yts[pane.id]) yts[pane.id] = []
                    yts[pane.id][uuid2] = this.storage[hash]
                    break
            }
        }
        this.store() // Store new state
    }

    // [API] Get y-transform of a specific scale
    getYtransform(gridId, scaleId) {
        return (this.yTransforms[gridId] || [])[scaleId]
    }

    // [API] Get auto precision of a specific overlay
    getAutoPrec(gridId, ovId) {
        return (this.autoPrecisions[gridId] || [])[ovId]
    }

    // [API] Get a precision smapler of a specific overlay
    getPreSampler(gridId, ovId) {
        return (this.preSamplers[gridId] || [])[ovId]
    }

    // [API] Get legend formatter of a specific overlay
    getLegendFns(gridId, ovId) {
        return (this.legendFns[gridId] || [])[ovId]
    }

    // [API] Get OHLC values to use as "magnet" values
    ohlc(t) {
        let el = this.ohlcMap[t]
        if (!el || !this.ohlcFn) return
        return this.ohlcFn(el.ref)
    }

    // EVENT HANDLERS

    // User changed y-range
    onYTransform(event) {
        let yts = this.yTransforms[event.gridId] || {}
        let tx = yts[event.scaleId] || {}
        yts[event.scaleId] = Object.assign(tx, event)
        this.yTransforms[event.gridId] = yts
        if (event.updateLayout) {
            this.events.emitSpec('chart', 'update-layout')
        }
        this.store()
    }

    // User tapped legend & selected the overlay
    onOverlaySelect(event) {
        this.selectedOverlay = event.index
        this.events.emit('$overlay-select', {
            index: event.index,
            ov: this.hub.overlay(...event.index)
        })
    }

    // Overlay/user set lock on scrolling
    onScrollLock(event) {
        this.scrollLock = event
    }
}


let instances = {}

function instance(id) {
    if (!instances[id]) {
        instances[id] = new MetaHub(id)
    }
    return instances[id]
}

export default {instance}
