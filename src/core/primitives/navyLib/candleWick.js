
// Drawing candle body seperately (for speed-up)

export default function candleWick(ctx, data) {

    let x05 = data.x - 1
    // let x05 = data.x;

    // ctx.moveTo(x05, Math.floor(data.h))
    // ctx.lineTo(x05, Math.floor(data.l))

    if (data.green) {
        ctx.moveTo(x05, data.h);
        ctx.lineTo(x05, data.c);

        ctx.moveTo(x05, data.l);
        ctx.lineTo(x05, data.o);
    } else {
        ctx.moveTo(x05, data.h);
        ctx.lineTo(x05, data.o);

        ctx.moveTo(x05, data.l);
        ctx.lineTo(x05, data.c);
    }
}
