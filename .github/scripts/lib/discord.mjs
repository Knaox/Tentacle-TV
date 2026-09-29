// Client REST Discord minimal pour le bot d'annonces. Zéro dépendance npm.
//
// Le jeton ne sort JAMAIS d'ici : il ne vit que dans l'en-tête Authorization,
// et les erreurs ne recopient que la méthode, le chemin et la réponse de
// Discord — qui ne le contient pas.
const API = 'https://discord.com/api/v10';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Les permissions qui comptent pour le bot d'annonces (bits de l'API Discord). */
export const PERMISSIONS = {
  ADMINISTRATOR: 1n << 3n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  EMBED_LINKS: 1n << 14n,
  READ_MESSAGE_HISTORY: 1n << 16n,
};
/** Ce qu'une annonce exige dans son salon. */
export const ANNOUNCE_NEEDS = ['VIEW_CHANNEL', 'SEND_MESSAGES', 'EMBED_LINKS', 'READ_MESSAGE_HISTORY'];

/**
 * Permissions effectives d'un membre dans un salon, dans l'ordre documenté
 * par Discord : @everyone puis ses rôles ; Administrateur ouvre tout ; puis
 * les dérogations du salon — @everyone, ses rôles, lui-même.
 */
export function effectivePermissions({ guildId, roles, memberRoleIds, userId, overwrites }) {
  const rolePerms = (id) => BigInt(roles.find((r) => r.id === id)?.permissions ?? 0);
  let base = rolePerms(guildId);
  for (const id of memberRoleIds) base |= rolePerms(id);
  if (base & PERMISSIONS.ADMINISTRATOR) return { admin: true, bits: base };
  let bits = base;
  const apply = (allow, deny) => {
    bits &= ~deny;
    bits |= allow;
  };
  const everyone = overwrites.find((o) => o.id === guildId);
  if (everyone) apply(BigInt(everyone.allow), BigInt(everyone.deny));
  let allow = 0n;
  let deny = 0n;
  for (const o of overwrites) {
    if (Number(o.type) === 0 && o.id !== guildId && memberRoleIds.includes(o.id)) {
      allow |= BigInt(o.allow);
      deny |= BigInt(o.deny);
    }
  }
  apply(allow, deny);
  const own = overwrites.find((o) => Number(o.type) === 1 && o.id === userId);
  if (own) apply(BigInt(own.allow), BigInt(own.deny));
  return { admin: false, bits };
}

/** Les permissions d'annonce qui manquent, par leur nom (vide si tout y est). */
export const missingPermissions = ({ admin, bits }) =>
  admin ? [] : ANNOUNCE_NEEDS.filter((name) => !(bits & PERMISSIONS[name]));

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
    roles: (guildId) => call('GET', `/guilds/${guildId}/roles`),
    member: (guildId, userId) => call('GET', `/guilds/${guildId}/members/${userId}`),
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
