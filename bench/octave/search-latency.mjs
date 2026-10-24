// Banc Octave : latence de /api/music/search (20 frappes). node search-latency.mjs <backend> <jeton Tentacle>
const [base, token] = process.argv.slice(2);
const queries = ["b", "br", "bri", "brig", "bright", "kevin", "polka", "ete", "noel", "oeuvre", "temoin", "dsd", "mouv", "mouvement 3", "four beers", "piano", "elegant", "ca dem", "flac", "nouvelle"];
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };
const client = [], server = [];
for (const q of queries) {
  const t0 = performance.now();
  const res = await fetch(`${base}/api/music/search?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json();
  const ms = performance.now() - t0;
  client.push(ms); server.push(body.tookMs);
  console.log(`${q.padEnd(12)} ${ms.toFixed(1).padStart(6)} ms client, ${String(body.tookMs).padStart(3)} ms serveur, ${body.tracks.length} titres ${body.albums.length} albums ${body.artists.length} artistes`);
}
console.log(`client  p50 ${pct(client, 50).toFixed(1)} ms  p95 ${pct(client, 95).toFixed(1)} ms  max ${Math.max(...client).toFixed(1)} ms (1re = ${client[0].toFixed(1)} ms)`);
console.log(`serveur p50 ${pct(server, 50)} ms  p95 ${pct(server, 95)} ms  max ${Math.max(...server)} ms`);
