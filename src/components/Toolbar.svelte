<script>
    import DataHub from "../core/dataHub.js";
    import ToolbarItem from "./ToolbarItem.svelte";
    import Events from "../core/events.js";
    import MetaHub from "../core/metaHub.js";

    export let props = {};
    export let layout = {};
    export let main = {};
    export let side = 'left'; // Add the side prop with default value

    let events = Events.instance(props.id);
    let meta = MetaHub.instance(props.id);

    let toolbarUpdId = `toolbar`;
    let toolbarId = `${props.id}-toolbar`;
    let canvasId = `${props.id}-toolbar-canvas`;
    let toolbarWidth = `${props.config.TOOLBAR}px`;
    let subs = {};

    let colors = props.colors;
    let b = props.config.TB_BORDER;
    let w = props.config.TOOLBAR - b;
    let c = colors.grid;
    let cb = colors.tbBack || colors.back;
    let brd = colors.tbBorder || colors.scale;
    let st = props.config.TB_B_STYLE;
    $:selectedTool = meta.tool;

    const generateTools = () => {
        let arr = [];
        let hub = DataHub.instance(props.id);
        for (const tool of hub.data.tools || []) {
            if (!tool.group) {
                arr.push(tool)
                continue
            }
            let g = arr.find(x => x.group === tool.group)
            if (!g) {
                arr.push({
                    group: tool.group,
                    icon: tool.icon,
                    type: tool.type,
                    label: tool?.label ?? tool.type,
                    items: [tool]
                })
            } else {
                g.items.push(tool)
            }
        }
        return arr
    }

    const tools = generateTools();

    $:toolbarStyle = `
        ${side === 'left' ? 'left: 0;' : 'right: 0;'}
        top: 0;
        position: absolute;
        background: ${props.colors.back};
        height: 100%;
        width: ${toolbarWidth};
        border-${side === 'left' ? 'right' : 'left'}: ${b}px ${st} ${brd}
    `;

    events.on('toolbar:tool-selected', (event) => {
        if (event.type === selectedTool) {
            selectedTool = undefined;
            return void 0;
        }

        selectedTool = event.type;
    });

    events.on('toolbar:drawing-mode-off', () => {
        if (selectedTool === 'Brush') {
            return void 0;
        }

        if (selectedTool === 'Magnet') {
            return void 0;
        }

        selectedTool = 'Cursor';
    });

    const isSelected = (tool) => {
        if (tool.group) {
            return !!tool.items.find(x => x.type === selectedTool);
        }

        return tool.type === selectedTool
    }

    const selectTool = (value) => {
        const data = value.detail;
        if (data.type === 'Trash') {
            events.emit('remove-all-tools', data);

            return void 0;
        }

        events.emit('tool-selected', data);

        subs[data.group] = data.type;
    }
</script>

<div id={toolbarId} style={toolbarStyle} class="nvjs-toolbar">
    {#if tools?.length}
        {#each tools as item, i}
            <ToolbarItem
                    {props}
                    toolbarItem={item}
                    selected="{isSelected(item, selectedTool)}"
                    subs={subs}
                    tools={tools}
                    selectedTool={selectedTool}
                    on:item-selected={selectTool}
            ></ToolbarItem>
        {/each}
    {/if}
</div>