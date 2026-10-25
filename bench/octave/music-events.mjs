// Banc Octave : écoute les évènements music:* d un compte. node music-events.mjs ws://…/api/ws <jeton> <secondes>
const [url, token, seconds] = process.argv.slice(2);
const t0 = Date.now();
const ws = new WebSocket(url);
const log = (m) => console.log(`${((Date.now() - t0) / 1000).toFixed(2)}s ${m}`);
ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token }));
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === "auth_ok") { log("auth_ok"); ws.send(JSON.stringify({ type: "session:hello", version: Number(process.env.V ?? 1), deviceId: "octave-a3-ws" })); return; }
  if (msg.type === "session:ready" || String(msg.type).startsWith("music:") || msg.type === "auth_error") log(JSON.stringify(msg));
};
ws.onclose = (e) => log(`close ${e.code}`);
setTimeout(() => { ws.close(); process.exit(0); }, Number(seconds) * 1000);
