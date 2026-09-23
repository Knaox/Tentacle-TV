// Client du démon CDP (cdpd.mjs) : node cdp.mjs '<expression>'
const expr = process.argv[2];
const res = await fetch("http://127.0.0.1:8767/eval", { method: "POST", body: expr });
console.log(await res.text());
