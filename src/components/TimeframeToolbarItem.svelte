<!-- filepath: /Users/kuba/Documents/Github/OmniCharts/src/components/TimeframeToolbarItem.svelte -->
<script>
    import {createEventDispatcher} from "svelte";

    // Component props
    export let props = {};
    export let timeframeItem = {};
    export let selected = false;

    // Component IDs
    let timeframeItemId = `${props.id}-timeframe-item-${timeframeItem.value}`;
    
    // Event dispatcher to communicate selection to parent
    const dispatch = createEventDispatcher();
    
    /**
     * Handle a click on a timeframe item
     * @param {Event} event - The click event
     */
    const selectTimeframe = (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        // Dispatch the selected timeframe to the parent component
        dispatch('item-selected', timeframeItem);
    };
</script>

<button 
    type="button"
    id={timeframeItemId}
    class="nvjs-timeframe-item"
    class:selected={selected}
    on:click={selectTimeframe}
    title={`Change timeframe to ${timeframeItem.label}`}
>
    {timeframeItem.label}
</button>

<style>
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
</style>