// Le lien du téléviseur, modélisé : la réponse part après le temps du
// serveur, puis au débit `mode.bw` (Mb/s, 0 = libre), par tranches de 10 ms.

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

export async function send(res, mode, status, headers, body, serverMs) {
  await sleep(Math.max(0, serverMs));
  res.writeHead(status, { ...headers, "content-length": body.length });
  const bytesPerMs = (mode.bw * 1e6) / 8 / 1000;
  if (!mode.bw || body.length < 16 * 1024) {
    // Petit corps : le temps du lien, d'un bloc.
    if (mode.bw) await sleep(body.length / bytesPerMs);
    res.end(body);
    return;
  }
  const chunk = Math.max(4096, Math.round(bytesPerMs * 10));
  for (let offset = 0; offset < body.length; offset += chunk) {
    if (res.destroyed) return;
    res.write(body.subarray(offset, offset + chunk));
    await sleep(10);
  }
  res.end();
}
