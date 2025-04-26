<script>
// ...existing code...
</script>

{#key chartRR} <!-- Full chart re-render -->
<div class="nvjs-chart" >
    {#if layout && layout.main}
        <Toolbar {props} side='left'/>

        {#each hub.panes() as pane, i}
            <Pane id={i}
                layout={layout.grids[i]}
                props={chartProps}
                main={pane === hub.chart}
            />
        {/each}
        <Botbar props={chartProps} {layout}/>
    {:else}
        <NoDataStub {props}/>
    {/if}
</div>
{/key}