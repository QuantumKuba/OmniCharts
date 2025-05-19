# ZLEMA

Zero-Lag Exponential Moving Average

## Description

The Zero-Lag Exponential Moving Average (ZLEMA) is an enhanced version of the traditional EMA designed to reduce lag while maintaining smoothness. It works by removing the lag from the input data before applying the EMA calculation, resulting in a more responsive moving average that better tracks current price action.

This implementation provides three ZLEMA lines (Fast, Medium, and Slow) and can optionally apply a Kalman filter to the input data to reduce noise. Additionally, it can display buy/sell signals based on Fast/Medium ZLEMA crossovers.

## Formula

ZLEMA uses a unique lag-adjustment formula:

1. Calculate lag: `lag = floor((period-1)/2)`
2. Create lag-adjusted price series: `X' = 2 * X - X[lag]`
3. Apply standard EMA calculation: `EMA(X', period)`

## Data Format

The indicator requires main overlay in the following format:

```js
[<timestamp>, <open>, <high>, <low>, <close>, <volume>]
```

## How to use

Add a new object with type `ZLEMA` to `scripts` array of a selected pane:
```js
// Pane object:
{
    overlays: [], // Non-generated overlays
    scripts: [{
        type: 'ZLEMA',
        props: {}, // Script props
        settings: {} // Script settings
    }]
}
```

::: tip
If you don't see the overlay, try to call `chart.se.uploadAndExec()`. This will upload the data to the script engine and execute all scripts.
:::

## Trading Signals

- Fast ZLEMA crossing above Medium ZLEMA generates a BUY signal
- Fast ZLEMA crossing below Medium ZLEMA generates a SELL signal
- The Slow ZLEMA provides longer-term trend context
- Kalman filter can improve signal quality in noisy markets

## Properties

### ZLEMA.src
- **Type:** `source`
- **Default:** `'hlc3'`
- **Description:** Input data source (close, high, low, hlc3, etc.)

### ZLEMA.enableKalman
- **Type:** `string`
- **Default:** `'ON'`
- **Options:** `['ON', 'OFF']`
- **Description:** Applies Kalman filter to input data for noise reduction

### ZLEMA.fast
- **Type:** `integer`
- **Default:** `8`
- **Min:** `1`
- **Description:** Period for the Fast ZLEMA line

### ZLEMA.medium
- **Type:** `integer`
- **Default:** `21`
- **Min:** `1`
- **Description:** Period for the Medium ZLEMA line

### ZLEMA.slow
- **Type:** `integer`
- **Default:** `55`
- **Min:** `1`
- **Description:** Period for the Slow ZLEMA line

### ZLEMA.showCross
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Toggle display of crossover signals

### ZLEMA.colorFast
- **Type:** `color`
- **Default:** `'#FFA500'`
- **Description:** Color for the Fast ZLEMA line

### ZLEMA.colorMedium
- **Type:** `color`
- **Default:** `'#00FFFF'`
- **Description:** Color for the Medium ZLEMA line

### ZLEMA.colorSlow
- **Type:** `color`
- **Default:** `'#888888'`
- **Description:** Color for the Slow ZLEMA line

### ZLEMA.signalSize
- **Type:** `integer`
- **Default:** `7`
- **Description:** Size of the crossover signal markers

### ZLEMA.buyColor
- **Type:** `color`
- **Default:** `'#08c65e'`
- **Description:** Color for buy signals

### ZLEMA.sellColor
- **Type:** `color`
- **Default:** `'#e42633'`
- **Description:** Color for sell signals

### ZLEMA.prec
- **Type:** `integer`
- **Default:** `autoPrec()`
- **Description:** Precision for values display