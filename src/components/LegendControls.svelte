<script>
    // Legend control buttons

    import {onMount} from 'svelte'
    import Events from '../core/events.js'
    import icons from '../assets/icons.json'

    export let gridId // gridId
    export let ov // Overlay
    export let props // General props
    // Unused external reference only
    export const height = 0 // legend controls height (external reference only)

    let events = Events.instance(props.id)

    $:display = ov.settings.display !== false
    $:state = display ? 'open' : 'closed'

    $:eyeStyle = `
    background-image: url(${icons[state + '-eye']});
    background-size: contain;
    background-repeat: no-repeat;
`

    export function update() {
        display = ov.settings.display !== false
    }

    function onDisplayClick() {
        events.emitSpec('hub', 'display-overlay', {
            paneId: gridId,
            ovId: ov.id,
            flag: ov.settings.display === undefined ? false : !ov.settings.display,
        })
    }

    const legendSettings = ov.settings.legendSettings !== undefined ? ov.settings.legendSettings : [];
</script>

<div class="legend-controls-container">
    <button type="button" class="nvjs-action-icon-wrapper" on:click|stopPropagation={onDisplayClick}>
        <div class="nvjs-action-icon" style={eyeStyle}></div>
    </button>

    {#if legendSettings.length > 0}
        {#each legendSettings as {id, icon}}
            <div class="nvjs-action-icon-wrapper">
                <div id={id} class="nvjs-action-icon" style="background-image: url({icon}); background-size: contain; background-repeat: no-repeat;"/>
            </div>
        {/each}
    {/if}
</div>

<style>
    .legend-controls-container {
        display: flex;
        gap: 5px;
        margin-left: 7px;
    }

    .nvjs-action-icon-wrapper {
        padding: 0 2px;
        border-radius: 5px;
    }

    .nvjs-action-icon {
        width: 20px;
        height: 20px;
        border-radius: 5px;
    }

    .nvjs-action-icon-wrapper:hover {
        filter: brightness(1.25);
        background-color: rgba(150, 150, 150, .4);
    }
</style>
<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<!--<div class="nvjs-eye" style={eyeStyle}-->
<!--    on:click|stopPropagation={onDisplayClick}>-->
<!--</div>-->
