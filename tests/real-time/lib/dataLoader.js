class DataLoader {
    constructor() {
        this.URL = "https://api1.binance.com/api/v3/klines";
        this.SYM = "BTCUSDT";
        this.TF = "1m"; // See binance api definitions

        this.loading = false;
    }

    async load(callback) {
        let url = `${this.URL}?symbol=${this.SYM}&interval=${this.TF}`;
        let result = await fetch(url);
        let data = await result.json();

        // Callback with extended panes and tools
        callback({
            panes: [
                {
                    overlays: [
                        {
                            name: "BTC / Tether US",
                            type: "Candles",
                            main: true,
                            data: data.map((x) => this.format(x)),
                            settings: {},
                            props: {},
                        },
                        {
                            name: "Heatmap",
                            type: "Heatmap",
                            main: false,
                            data: data.map((x) => this.format(x)),
                            settings: {},
                            props: {},
                        },
                        {
                            name: "RangeTool",
                            type: "RangeTool",
                            drawingTool: true,
                            data: [],
                            props: {},
                            settings: {
                                zIndex: 1000,
                            },
                        },
                        {
                            name: "LineTool",
                            type: "LineTool",
                            drawingTool: true,
                            data: [
                                {
                                    type: "segment",
                                    p1: [1702108800000, 73.05],
                                    p2: [1702296000000, 75.23],
                                    uuid: "6822450897812908",
                                    color: "#dc9800",
                                    lineWidth: "1",
                                },
                            ],
                            props: {},
                            settings: {
                                zIndex: 1000,
                            },
                        },
                        {
                            name: "LineToolHorizontalRay",
                            type: "LineToolHorizontalRay",
                            drawingTool: true,
                            data: [
                                {
                                    type: "ray",
                                    p1: [1702108800000, 71.05],
                                    uuid: "123",
                                    color: "#dc9800",
                                    lineWidth: "1",
                                },
                            ],
                            props: {},
                            settings: {
                                zIndex: 1000,
                            },
                        },
                    ],
                }, {
                    // Separate pane for MACD
                    scripts: [
                        {
                            type: "MACD",
                        },
                    ],
                },
                {
                    // Separate pane for Stochastic Oscillator
                    scripts: [
                        {
                            type: "Stoch",
                        },
                    ],
                },
            ], tools: [
                {
                    type: "Cursor",
                    icon: `<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M480-400q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm-40-240v-200h80v200h-80Zm0 520v-200h80v200h-80Zm200-320v-80h200v80H640Zm-520 0v-80h200v80H120Z"/></svg>`,
                },
                {
                    type: "Brush",
                    label: "Brush",
                    // group: "BrushTool",
                    icon: "\n<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\n<svg width=\"24px\" height=\"24px\" viewBox=\"0 -2 32 32\" version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n    \n    <title>brush</title>\n       <defs>\n\n</defs>\n    <g id=\"Page-1\" stroke=\"none\" stroke-width=\"1\" fill=\"none\" fill-rule=\"evenodd\" sketch:type=\"MSPage\">\n        <g id=\"Icon-Set\" sketch:type=\"MSLayerGroup\" transform=\"translate(-99.000000, -154.000000)\" fill=\"currentColor\">\n            <path d=\"M128.735,157.585 L116.047,170.112 L114.65,168.733 L127.339,156.206 C127.725,155.825 128.35,155.825 128.735,156.206 C129.121,156.587 129.121,157.204 128.735,157.585 L128.735,157.585 Z M112.556,173.56 C112.427,173.433 111.159,172.181 111.159,172.181 L113.254,170.112 L114.65,171.491 L112.556,173.56 L112.556,173.56 Z M110.461,178.385 C109.477,179.298 105.08,181.333 102.491,179.36 C102.491,179.36 103.392,178.657 104.074,177.246 C105.703,172.919 109.763,173.56 109.763,173.56 L111.159,174.938 C111.173,174.952 112.202,176.771 110.461,178.385 L110.461,178.385 Z M130.132,154.827 C128.975,153.685 127.099,153.685 125.942,154.827 L108.764,171.788 C106.661,171.74 103.748,172.485 102.491,176.603 C101.53,178.781 99,178.671 99,178.671 C104.253,184.498 110.444,181.196 111.857,179.764 C113.1,178.506 113.279,176.966 113.146,175.734 L130.132,158.964 C131.289,157.821 131.289,155.969 130.132,154.827 L130.132,154.827 Z\" id=\"brush\" sketch:type=\"MSShapeGroup\">\n\n</path>\n        </g>\n    </g>\n</svg>"
                },
                {
                    type: "LineTool",
                    label: "Line",
                    // group: "LineTool",
                    icon: "\n<?xml version=\"1.0\" encoding=\"utf-8\"?><!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools -->\n<svg width=\"24px\" height=\"24px\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M18 5C17.4477 5 17 5.44772 17 6C17 6.27642 17.1108 6.52505 17.2929 6.70711C17.475 6.88917 17.7236 7 18 7C18.5523 7 19 6.55228 19 6C19 5.44772 18.5523 5 18 5ZM15 6C15 4.34315 16.3431 3 18 3C19.6569 3 21 4.34315 21 6C21 7.65685 19.6569 9 18 9C17.5372 9 17.0984 8.8948 16.7068 8.70744L8.70744 16.7068C8.8948 17.0984 9 17.5372 9 18C9 19.6569 7.65685 21 6 21C4.34315 21 3 19.6569 3 18C3 16.3431 4.34315 15 6 15C6.46278 15 6.90157 15.1052 7.29323 15.2926L15.2926 7.29323C15.1052 6.90157 15 6.46278 15 6ZM6 17C5.44772 17 5 17.4477 5 18C5 18.5523 5.44772 19 6 19C6.55228 19 7 18.5523 7 18C7 17.7236 6.88917 17.475 6.70711 17.2929C6.52505 17.1108 6.27642 17 6 17Z\" fill=\"currentColor\"/>\n</svg>"
                },
                {
                    type: "LineToolHorizontalRay",
                    label: "Horizontal Ray (Right Click)",
                    // group: "LineToolHorizontalRay",
                    "icon": "<svg fill=\"currentColor\" xmlns=\"http://www.w3.org/2000/svg\" height=\"24\" viewBox=\"0 -960 960 960\" width=\"24\"><path d=\"M180-380q-42 0-71-29t-29-71q0-42 29-71t71-29q31 0 56 17t36 43h608v80H272q-11 26-36 43t-56 17Z\"/></svg>\n"
                },
                {
                    type: "RangeTool",
                    label: "Measure",
                    icon: "\n<?xml version=\"1.0\" encoding=\"utf-8\"?><!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools -->\n<svg version=\"1.1\" id=\"Uploaded to svgrepo.com\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" \n\t width=\"24px\" height=\"24px\" viewBox=\"0 0 32 32\" xml:space=\"preserve\">\n<style type=\"text/css\">\n\t.linesandangles_een{fill:currentColor;}\n</style>\n<path class=\"linesandangles_een\" d=\"M21,1.586L2.586,20L12,29.414L30.414,11L21,1.586z M5.414,20L21,4.414L27.586,11L26.5,12.086\n\tl-1.793-1.793l-1.414,1.414l1.793,1.793L23.5,15.086l-3.793-3.793l-1.414,1.414l3.793,3.793L20.5,18.086l-1.793-1.793l-1.414,1.414\n\tl1.793,1.793L17.5,21.086l-1.793-1.793l-1.414,1.414l1.793,1.793L14.5,24.086l-3.793-3.793l-1.414,1.414l3.793,3.793L12,26.586\n\tL5.414,20z\"/>\n</svg>"
                },
                {
                    type: "Magnet",
                    label: "Magnet",
                    icon: "\n<?xml version=\"1.0\" encoding=\"utf-8\"?><!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools -->\n<svg width=\"24px\" height=\"24px\" viewBox=\"0 0 512 512\" xmlns=\"http://www.w3.org/2000/svg\"><title>ionicons-v5-o</title><path d=\"M421.83,293.82A144,144,0,0,0,218.18,90.17\" style=\"fill:none;stroke:currentColor;stroke-miterlimit:10;stroke-width:32px\"/><path d=\"M353.94,225.94a48,48,0,0,0-67.88-67.88\" style=\"fill:none;stroke:currentColor;stroke-miterlimit:10;stroke-width:32px\"/><line x1=\"192\" y1=\"464\" x2=\"192\" y2=\"416\" style=\"stroke:currentColor;stroke-linecap:round;stroke-miterlimit:10;stroke-width:32px\"/><line x1=\"90.18\" y1=\"421.82\" x2=\"124.12\" y2=\"387.88\" style=\"stroke:currentColor;stroke-linecap:round;stroke-miterlimit:10;stroke-width:32px\"/><line x1=\"48\" y1=\"320\" x2=\"96\" y2=\"320\" style=\"stroke:currentColor;stroke-linecap:round;stroke-miterlimit:10;stroke-width:32px\"/><path d=\"M286.06,158.06,172.92,271.19a32,32,0,0,1-45.25,0L105,248.57a32,32,0,0,1,0-45.26L218.18,90.17\" style=\"fill:none;stroke:currentColor;stroke-linejoin:round;stroke-width:32px\"/><path d=\"M421.83,293.82,308.69,407a32,32,0,0,1-45.26,0l-22.62-22.63a32,32,0,0,1,0-45.26L353.94,225.94\" style=\"fill:none;stroke:currentColor;stroke-linejoin:round;stroke-width:32px\"/><line x1=\"139.6\" y1=\"169.98\" x2=\"207.48\" y2=\"237.87\" style=\"fill:none;stroke:currentColor;stroke-linejoin:round;stroke-width:32px\"/><line x1=\"275.36\" y1=\"305.75\" x2=\"343.25\" y2=\"373.63\" style=\"fill:none;stroke:currentColor;stroke-linejoin:round;stroke-width:32px\"/></svg>"
                },
                {
                    type: "Trash",
                    icon: "\n<?xml version=\"1.0\" encoding=\"utf-8\"?><!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools -->\n<svg width=\"24px\" height=\"24px\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<path d=\"M18 6L17.1991 18.0129C17.129 19.065 17.0939 19.5911 16.8667 19.99C16.6666 20.3412 16.3648 20.6235 16.0011 20.7998C15.588 21 15.0607 21 14.0062 21H9.99377C8.93927 21 8.41202 21 7.99889 20.7998C7.63517 20.6235 7.33339 20.3412 7.13332 19.99C6.90607 19.5911 6.871 19.065 6.80086 18.0129L6 6M4 6H20M16 6L15.7294 5.18807C15.4671 4.40125 15.3359 4.00784 15.0927 3.71698C14.8779 3.46013 14.6021 3.26132 14.2905 3.13878C13.9376 3 13.523 3 12.6936 3H11.3064C10.477 3 10.0624 3 9.70951 3.13878C9.39792 3.26132 9.12208 3.46013 8.90729 3.71698C8.66405 4.00784 8.53292 4.40125 8.27064 5.18807L8 6\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n</svg>"
                },
            ],
        });
    }

    async loadMore(endTime, callback) {
        if (this.loading) return;
        this.loading = true;
        let url = `${this.URL}?symbol=${this.SYM}&interval=${this.TF}`;
        url += `&endTime=${endTime}`;
        let result = await fetch(url);
        let data = await result.json();
        callback(data.map((x) => this.format(x)));
        this.loading = false;
    }

    format(x) {
        return [
            x[0],
            parseFloat(x[1]),
            parseFloat(x[2]),
            parseFloat(x[3]),
            parseFloat(x[4]),
            parseFloat(x[7])
        ];
    }
}

export { DataLoader };
