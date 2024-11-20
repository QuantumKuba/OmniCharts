/**
 * MetaHub class is a container for y-transforms, meta functions, and other information
 * about overlays (e.g., yRange). It manages events, persistent meta storage, and 
 * various overlay-related functionalities.
 */

// import Utils from '../stuff/utils.js'
import Events from './events.js'
import DataHub from './dataHub.js'

class MetaHub {

    /**
     * Constructor for MetaHub.
     * @param {string} nvId - The ID for the MetaHub instance.
     */
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
        events.on('meta:change-tool-data', this.changeToolData.bind(this));
        events.on('meta:object-selected', this.objectSelected.bind(this));
        events.on('meta:remove-all-tools', this.removeAllTools.bind(this));
        events.on('meta:keyboard-keydown', this.toggleMagnetOnCtrlKeyDown.bind(this));
        events.on('meta:keyboard-keyup', this.resetMagnetOnCtrlUp.bind(this));

        // Persistent meta storage
        this.storage = {};
        this.heatmap = undefined;

        this.tool = 'Cursor';
        this.drawingMode = false;
        this.selectedTool = undefined;
        this.magnet = false
    }

    /**
     * Initializes MetaHub with properties and layout.
     * @param {Object} props - Properties for initialization.
     * @param {Object} layout - Layout for initialization.
     */
    init(props, layout) {
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
        this.ohlcMap = [] // time => OHLC map of the main overlay
        this.ohlcFn = undefined // OHLC mapper function
        this.scrollLock = false // Scroll lock state
    }

    /**
     * Handles keyboard key down event.
     * @param {Object} event - The keyboard event.
     */
    toggleMagnetOnCtrlKeyDown(event) {
        this.magnet = event.ctrlKey;
    }

    /**
     * Handles keyboard key up event.
     * @param {Object} event - The keyboard event.
     */
    resetMagnetOnCtrlUp(event) {
        if (this.magnet) {
            this.magnet = false;
        }
    }

    /**
     * Initializes the heatmap with a given ID.
     * @param {string} id - The ID for the heatmap.
     */
    initHeatmap(id) {
        this.heatmap = new Heatmap(id);
    }

    /**
     * Destroys the heatmap instance.
     */
    destroyHeatmap() {
        this.heatmap.destroy();
        this.heatmap = undefined;
    }

    /**
     * Resets the heatmap instance.
     */
    resetHeatmap() {
        this.heatmap.reset();
    }

    /**
     * Handles grid mousedown event and deselects all overlays.
     * @param {Object} event - The mousedown event.
     */
    onGridMousedown(event) {
        this.selectedOverlay = undefined
        this.events.emit('$overlay-select', {
            index: undefined,
            ov: undefined
        });
    }

    /**
     * Changes tool data for a specific overlay.
     * @param {Object} param - Object containing overlay ID and update data.
     */
    changeToolData = ({ id, data }) => {
        const overlay = this.hub.data.panes[0].overlays.find(overlay => overlay.id === id);
        overlay.data = data ?? [];

        this.events.emit('commit-tool-changes');
    }

    /**
     * Handles object selection event.
     * @param {Object} param -  Object containing the ID of the selected object.
     * */
    objectSelected = ({ id }) => {
        this.selectedTool = id;
    }

    /**
     * Removes all tools from the overlays and reset the drawing mode.
     */
    removeAllTools = () => {
        for (const drawingOverlay of this.hub.data.panes[0].overlays) {
            if (drawingOverlay.drawingTool) {
                drawingOverlay.data = [];
                drawingOverlay.dataExt = {};
            }
        }

        this.drawingModeOff();
        this.events.emit('object-selected', { id: undefined });
        this.events.emitSpec('chart', 'update-layout');
        this.events.emit('commit-tool-changes');
    }

    /**
     * Turns off drawing mode and resets the tool to Cursor.
     */
    drawingModeOff = () => {
        if (this.tool === 'Brush') {
            return void 0;
        }
        if (this.tool === 'Magnet') {
            return void 0;
        }

        this.tool = 'Cursor';
        this.drawingMode = false;
    }

    /**
     * Handles tool selection event.
     * @param {Object} event - The tool selection event object.
     */
    toolSelected = (event) => {
        if (this.tool === event.type) {
            this.magnet = false;
            this.tool = 'Cursor';
            this.drawingMode = false;
            return void 0;
        }

        this.tool = event.type;

        if (this.tool === 'Magnet') {
            this.magnet = true;
        }
    }

    /**
     * Extracts meta functions from an overlay and stores them.
     * @param {Object} overlay - The overlay object.
     */
    exctractFrom(overlay) {
        let gridId = overlay.gridId()
        let id = overlay.id()

        // yRange functions
        // Populate functions based on overlay methods
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

    /**
     * Calculates OHLC map.
     */
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

    /**
     * Stores auto precision for a specific overlay.
     * @param {string} gridId - The grid ID.
     * @param {string} ovId - The overlay ID.
     * @param {number} prec - The precision value.
     */
    setAutoPrec(gridId, ovId, prec) {
        let aps = this.autoPrecisions[gridId] || []
        aps[ovId] = prec
        this.autoPrecisions[gridId] = aps
    }

    /**
     * Finalizes the processing of overlays.
     */
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

    /**
     * Stores meta information such as y-transform by (pane.uuid + scaleId) hash.
     */
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

    /**
     * Restores meta information after an update in the pane/overlay order.
     */
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

    /**
     * Gets y-transform of a specific scale.
     * @param {string} gridId - The grid ID.
     * @param {string} scaleId - The scale ID.
     * @returns {Object} The y-transform object.
     */
    getYtransform(gridId, scaleId) {
        return (this.yTransforms[gridId] || [])[scaleId]
    }

    /**
     * Gets auto precision of a specific overlay.
     * @param {string} gridId - The grid ID.
     * @param {string} ovId - The overlay ID.
     * @returns {number} The auto precision value.
     */
    getAutoPrec(gridId, ovId) {
        return (this.autoPrecisions[gridId] || [])[ovId]
    }

    /**
     * Gets precision sampler of a specific overlay.
     * @param {string} gridId - The grid ID.
     * @param {string} ovId - The overlay ID.
     * @returns {Object} The precision sampler object.
     */
    getPreSampler(gridId, ovId) {
        return (this.preSamplers[gridId] || [])[ovId]
    }

    /**
     * Gets legend formatter of a specific overlay.
     * @param {string} gridId - The grid ID.
     * @param {string} ovId - The overlay ID.
     * @returns {Object} The legend formatter object.
     */
    getLegendFns(gridId, ovId) {
        return (this.legendFns[gridId] || [])[ovId]
    }

    /**
     * Gets OHLC values to use as "magnet" values.
     * @param {number} t - The timestamp.
     * @returns {Object} The OHLC values.
     */
    ohlc(t) {
        let el = this.ohlcMap[t]
        if (!el || !this.ohlcFn) return
        return this.ohlcFn(el.ref)
    }

    // EVENT HANDLERS

    /**
     * Handles y-transform change event.
     * @param {Object} event - The y-transform event.
     */
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

    /**
     * Handles overlay selection event.
     * @param {Object} event - The overlay selection event.
     */
    onOverlaySelect(event) {
        this.selectedOverlay = event.index
        this.events.emit('$overlay-select', {
            index: event.index,
            ov: this.hub.overlay(...event.index)
        })
    }

    /**
     * Handles scroll lock event.
     * @param {Object} event - The scroll lock event.
     */
    onScrollLock(event) {
        this.scrollLock = event
    }
}


let instances = {}

/**
 * Returns an instance of MetaHub.
 * @param {string} id - The ID for the MetaHub instance.
 * @returns {MetaHub} The MetaHub instance.
 */
function instance(id) {
    if (!instances[id]) {
        instances[id] = new MetaHub(id)
    }
    return instances[id]
}

export default { instance }
