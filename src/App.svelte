<!-- App.svelte -->
<script>
    import.meta.hot;
    import { NightVision } from "./index.js";
    import { onMount } from "svelte";
    // import data from "../data/data-ohlcv-rsi.json?id=main";
    // import data2 from "../data/data-area.json?id=main-2";
    // import data3 from "../data/data-aapl.json?id=main-3";
    import TestStack from "../tests/testStack.js";

    // Tests
    import fullReset from "../tests/data-sync/fullReset.js";
    import paneAddRem from "../tests/data-sync/paneAddRem.js";
    import paneSettings from "../tests/data-sync/paneSettings.js";
    import ovAddRem from "../tests/data-sync/ovAddRem.js";
    import scaleChange from "../tests/data-sync/scaleChange.js";
    import mainOverlay from "../tests/data-sync/mainOverlay.js";
    import ovSettings from "../tests/data-sync/ovSettings.js";
    import ovPropsChange from "../tests/data-sync/ovPropsChange.js";
    import ovDataChange from "../tests/data-sync/ovDataChange.js";

    // More tests
    import realTime from "../tests/real-time/realTime.js";
    // More tests
    import timeBased from "../tests/tfs-test/allTimeBased.js";
    import indexBased from "../tests/tfs-test/allIndexBased.js";
    // More tests
    import indicators from "../tests/indicators/indicators.js";
    import rangeTool from "../tests/tools/rangeTool.js";
    import lineTool from "../tests/tools/lineTool.js";
    import watchPropTest from "../tests/navy/watchPropTest.js";

    // More tests
    import logScaleTest from "../tests/scales/logScale.js";
    import memoryTest from "../tests/memory/memoryTest.js";

    // Live data
    import { DataLoader } from "../tests/real-time/lib/dataLoader.js";
    import wsx from "../tests/real-time/lib/wsx.js";
    import sampler from "../tests/real-time/lib/ohlcvSampler.js";

    import heatmapScript from "./scripts/heatmap.navy";

    /*
    TODO: data-api interface:
    .getPanes()
    .getAllOverlays()
    .pane('main').getRenderers()
    .pane(0).getOverlay('<name>').getRenderer() // id
    ...
    */

    // TODO: Memory leak tests

    let stack = new TestStack();
    let chart = null;
    let data = [];

    //data.indexBased = true

    onMount(() => {
        chart = new NightVision("chart-container", {
            data: data,
            autoResize: true,
            //indexBased: true
        });
        //chart.data = data2

        let dl = new DataLoader();

        // Load the first piece of the data
        dl.load((data) => {
            chart.data = data; // Set the initial data
            chart.fullReset(); // Reset tre time-range
            chart.se.uploadAndExec(); // Upload & exec scripts
        });

        function loadMore() {      
            if (!chart.hub.mainOv) {
                setTimeout(update, 100); // Retry after a short delay
                return;
            }
            let data = chart.hub.mainOv.data;
            let t0 = data[0][0];
            if (chart.range[0] < t0) {
                dl.loadMore(t0 - 1, (chunk) => {
                    // Add a new chunk at the beginning
                    data.unshift(...chunk);
                    // Yo need to update "data"
                    // when the data range is changed
                    chart.update("data");
                    chart.se.uploadAndExec();
                });
            }
        }

        // Send an update to the script engine
        async function update() {
            if (!chart.hub.mainOv) {
                setTimeout(update, 100); // Retry after a short delay
                return;
            }
            await chart.se.updateData();
            var delay; // Floating update rate
            if (chart.hub.mainOv.dataSubset.length < 1000) {
                delay = 10;
            } else {
                delay = 1000;
            }
            setTimeout(update, delay);
    }

        // Load new data when user scrolls left
        chart.events.on("app:$range-update", loadMore);

        // Plus check for updates every second
        setInterval(loadMore, 500);

        // TA + chart update loop
        setTimeout(update, 0);

        // Setup a trade data stream
        wsx.init([dl.SYM]);
        wsx.ontrades = (d) => {
            if (!chart.hub.mainOv) return;
            let data = chart.hub.mainOv.data;
            let trade = {
                price: d.price,
                volume: d.price * d.size,
            };
            if (sampler(data, trade)) {
                chart.update("data"); // New candle
                chart.scroll(); // Scroll forward
            }
        };
        window.wsx = wsx;
        window.chart = chart;
        window.stack = stack;

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
</div>

<style>
    .app {
        /* width: 1080px; */
        /* height: 720px; */
        /* margin: 0 auto; */
        /* position: relative; */
        /* overflow: hidden; */
    }

    #chart-container {
        position: absolute;
        width: 100%;
        height: 100%;
    }
</style>
