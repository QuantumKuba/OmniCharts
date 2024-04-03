export default function candleBodyTransparent(ctx, data, layout, width) {
    let x05 = data.x - 1
    // let x05 = data.x
    ctx.lineWidth = 1;

    const height = data.c < data.o ? data.o - data.c : data.c - data.o;

    ctx.rect(x05 - width / 2, Math.min(data.o - 1, data.c - 1), width, height)
}