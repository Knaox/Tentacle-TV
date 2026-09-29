// Client REST Discord minimal pour le bot d'annonces. Zéro dépendance npm.
//
// Le jeton ne sort JAMAIS d'ici : il ne vit que dans l'en-tête Authorization,
// et les erreurs ne recopient que la méthode, le chemin et la réponse de
// Discord — qui ne le contient pas.
const API = 'https://discord.com/api/v10';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class DiscordError extends Error {
  constructor(method, path, status, body) {
    super(`${method} ${path} → ${status} ${JSON.stringify(body)}`);
    this.status = status;
  }
}

export function createDiscordClient(token, { fetchImpl = fetch } = {}) {
  async function call(method, path, body) {
    // Discord répond 429 avec le délai à attendre ; trois tentatives suffisent.
    for (let attempt = 1; ; attempt++) {
      const r = await fetchImpl(API + path, {
        method,
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'DiscordBot (https://github.com/Knaox/Tentacle-TV, 1.0)',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
      if (r.status === 429 && attempt < 3) {
        const j = await r.json().catch(() => ({}));
        await sleep(Math.min(Number(j.retry_after ?? 1), 30) * 1000 + 250);
        continue;
      }
      if (r.status === 204) return null;
      const text = await r.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text.slice(0, 200);
      }
      if (!r.ok) throw new DiscordError(method, path, r.status, data);
      return data;
    }
  }

  return {
    me: () => call('GET', '/users/@me'),
    channel: (id) => call('GET', `/channels/${id}`),
    /** Les derniers messages d'un salon, du plus récent au plus ancien (au plus `pages` × 100). */
    async recentMessages(channelId, pages = 2) {
      const all = [];
      let before = null;
      for (let i = 0; i < pages; i++) {
        const batch = await call('GET', `/channels/${channelId}/messages?limit=100${before ? `&before=${before}` : ''}`);
        all.push(...(batch ?? []));
        if (!batch || batch.length < 100) break;
        before = batch.at(-1).id;
      }
      return all;
    },
    post: (channelId, payload) => call('POST', `/channels/${channelId}/messages`, payload),
    edit: (channelId, messageId, payload) => call('PATCH', `/channels/${channelId}/messages/${messageId}`, payload),
    /** Publie un message d'un salon d'annonces vers les serveurs qui le suivent. */
    crosspost: (channelId, messageId) => call('POST', `/channels/${channelId}/messages/${messageId}/crosspost`),
  };
}
