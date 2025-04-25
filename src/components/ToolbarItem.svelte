<script>
    import Events from '../core/events.js'
    import {createEventDispatcher} from "svelte";

    export let props = {};
    export let toolbarItem = {};
    export let subs = {};
    export let tools = [];
    export let selectedTool = undefined;
    export let selected = false;

    let toolbarItemUpdId = `toolbar-item`;
    let toolbarItemId = `${props.id}-toolbar-item`;
    let canvasId = `${props.id}-toolbar-item-canvas`;
    let showExpList = false;
    let subItem;
    let events = Events.instance(props.id);
    const dispatch = createEventDispatcher();

    if (toolbarItem.group) {
        let type = subs[toolbarItem.group]
        let item = toolbarItem.items.find(x => x.type === type)
        if (item) subItem = item
    }

    window.addEventListener('mousedown', () => showExpList = false);

    const getToolbarItemStyle = () => {
        let conf = props.config
        let im = conf.TB_ITEM_M
        let m = (conf.TOOLBAR - conf.TB_ICON) * 0.5 - im
        let s = conf.TB_ICON + im * 2
        // let b = this.exp_hover ? 0 : 3
        let b = 2;
        return `
            width: ${s}px;
            height: ${s}px;
            margin: 8px ${m}px 0px ${m}px;
            border-radius: 3px ${b}px ${b}px 3px
        `
    }

    $:getIconStyle = `
        width: ${props.config.TB_ICON}px;
        height: ${props.config.TB_ICON}px;
        padding: ${props.config.TB_ITEM_M}px;
        color: #d1d4dc;
    `;

    const getSubItem = () => {
        const group = tools.find((tool) => tool.group === toolbarItem.group);
        if (group?.items?.length) {
            const selectedSubTool = group.items.find((tool) => tool.type === selectedTool);
            if (selectedSubTool) {
                subItem = selectedSubTool;
            }
        }

        return subItem;
    }

    const getToolbarExpStyle = () => {
        let conf = props.config;
        let im = conf.TB_ITEM_M;
        let s = conf.TB_ICON * 0.5 + im;
        let p = (conf.TOOLBAR - s * 2) / 4;
        return `
            padding: ${s}px ${p}px;
        `
    }

    const getToolbarChildItemStyle = () => {
        let conf = props.config
        let h = conf.TB_ICON + conf.TB_ITEM_M * 2 + 8
        // let sel = this.dc.tool === item.type
        return `
            height: ${h}px;
            color: #d1d4dc;
        `
    }

    const getChildIconStyle = (data) => {
        let conf = props.config
        let br = conf.TB_ICON_BRI
        let im = conf.TB_ITEM_M
        return `
            width: 25px;
            min-width: 25px;
            height: 25px;
            margin: ${im}px;
        `
    }

    const getChildListStyle = () => {
        let conf = props.config;
        let w = conf.TOOLBAR;
        let brd = props.colors.grid;
        let bstl = `1px solid ${brd}`;
        return `
            left: ${w + 1}px;
            background: ${props.colors.back};
            border-top: ${bstl};
            border-right: ${bstl};
            border-bottom: ${bstl};
        `
    }

    const toolbarItemClick = (event) => {
        event.preventDefault();
    }

    const toolbarItemExtClick = (event) => {
        event.preventDefault();
        showExpList = !showExpList;
    }

    const selectTool = (event, value) => {
        event.preventDefault();
        event.stopPropagation();
        showExpList = false;

        if (!toolbarItem?.group) {
            dispatch('item-selected', toolbarItem);
        } else {
            let item = subItem || toolbarItem.items[0]
            dispatch('item-selected', item);
        }
    }

    const selectToolSub = (event, value) => {
        event.preventDefault();
        event.stopPropagation();
        subItem = value;
        selectTool(event, value);
    }

</script>

<style>
    .nvjs-toolbar-item {
        transition: ease-in-out .2s;
        background: none;
        border: none;
        padding: 0;
    }

    /* Reset buttons for transparent icon-only appearance */
    button.nvjs-toolbar-item-icon,
    button.nvjs-toolbar-item-exp,
    button.nvjs-list-item {
        background: transparent;
        border: none;
        padding: 0;
        margin: 0;
        cursor: pointer;
    }
    button.nvjs-toolbar-item-icon:focus,
    button.nvjs-toolbar-item-exp:focus,
    button.nvjs-list-item:focus {
        outline: none;
    }

    .nvjs-toolbar-item:hover {
        background-color: #76878319;
    }

    .nvjs-toolbar-item-exp {
        position: absolute;
        right: -3px;
        padding: 18.5px 5px;
        font-stretch: extra-condensed;
        font-size: 0.6em;
        opacity: 0.0;
        user-select: none;
        line-height: 0;
        transform: scale(0.6, 1);
        transition: ease-in-out .2s;
    }

    .nvjs-toolbar-item:hover .nvjs-toolbar-item-exp {
        opacity: 0.5;
    }

    .nvjs-toolbar-item-exp.opened {
        transform: scale(-0.6, 1);
    }

    .nvjs-toolbar-item-exp:hover {
        background-color: #76878330;
        opacity: 0.9 !important;
    }

    .nvjs-toolbar-item-icon {
        position: absolute;
        transition: ease-in-out .2s;
    }

    .nvjs-toolbar-item.selected > .nvjs-toolbar-item-icon,
    .nvjs-list-item.selected > .nvjs-list-item-icon {
        color: #dc9800 !important;
    }

    .nvjs-pixelated {
        -ms-interpolation-mode: nearest-neighbor;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: -webkit-crisp-edges;
        image-rendering: -moz-crisp-edges;
        image-rendering: -o-crisp-edges;
        image-rendering: pixelated;
        transition: ease-in-out .2s;
    }

    .nvjs-item-list {
        position: absolute;
        user-select: none;
        margin-top: -5px;
        z-index: 1;
        transition: ease-in-out .2s;
    }

    .nvjs-list-item {
        display: flex;
        align-items: center;
        padding-right: 20px;
        font-size: 12px;
        letter-spacing: 0.05em;
        transition: ease-in-out .2s;
        text-wrap: nowrap;
    }

    .nvjs-list-item:hover {
        background-color: #76878319;
    }

    .nvjs-list-item * {
        position: relative !important;
    }
</style>

<div
        id={toolbarItemId}
        style={getToolbarItemStyle()}
        class="nvjs-toolbar-item"
        class:selected={selected}
>
    {#if (getSubItem(selectedTool) ? getSubItem(selectedTool).icon : toolbarItem.icon)?.trim()}
    <button type="button"
            class="nvjs-toolbar-item-icon nvjs-pixelated"
            style={getIconStyle}
            on:click={(event) => selectTool(event, toolbarItem)}
    >
        {@html getSubItem(selectedTool) ? getSubItem(selectedTool).icon : toolbarItem.icon}
    </button>
    {/if}

    {#if toolbarItem?.items?.length}
        <button type="button"
                class="nvjs-toolbar-item-exp"
                class:opened={showExpList}
                style={getToolbarExpStyle()}
                on:click={toolbarItemExtClick}
        >ᐳ</button>
    {/if}

    {#if toolbarItem?.items?.length && showExpList}
        <div class="nvjs-item-list" style={getChildListStyle()}>
            {#each toolbarItem.items as groupItem, i}
                <button type="button"
                        class="nvjs-list-item"
                        class:selected={groupItem.type === selectedTool}
                        style={getToolbarChildItemStyle()}
                        on:click={(event) => selectToolSub(event, groupItem)}
                        title={groupItem.label}
                >
                    <div class="nvjs-list-item-icon nvjs-pixelated" style={getChildIconStyle(groupItem)}>
                        {@html groupItem.icon}
                    </div>
                    <div>{groupItem.label}</div>
                </button>
            {/each}
        </div>
    {/if}
</div>