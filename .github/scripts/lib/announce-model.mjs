// Le modèle des annonces Discord : quelles plateformes, quelles boutiques, et
// le message d'une version — construit ET relu. Aucune entrée/sortie ici.
//
// UN MESSAGE PAR (plateforme, version) et par langue. Il naît quand une
// boutique sert une version plus haute que son seuil (`floors`), puis
// s'ENRICHIT à mesure que les autres boutiques la servent : « Mac App Store »
// d'abord, « Microsoft Store » ajouté au passage suivant. L'état vit dans
// Discord même — le pied du message porte la plateforme et la version, ses
// boutons les boutiques — donc rien à commiter, et un run rejoué ne double rien.
import { compareVersions, isVersion, maxVersion } from './versions.mjs';

const REPO = 'https://github.com/Knaox/Tentacle-TV';
const APP_STORE = 'https://apps.apple.com/app/id6760205634';
const PLAY = 'https://play.google.com/store/apps/details?id=com.tentacletv.mobile';
export const BRAND_COLOR = 0x8b5cf6;
/** Marge sous la limite de 4096 caractères d'une description d'embed. */
export const DESCRIPTION_MAX = 3800;

// Les libellés des boutons servent aussi à RELIRE un message : uniques par plateforme.
export const STORES = {
  macos: { label: 'Mac App Store', emoji: '🍎', url: () => `${APP_STORE}?platform=mac` },
  windows: { label: 'Microsoft Store', emoji: '🪟', url: () => 'https://apps.microsoft.com/detail/9NKHL0T84245' },
  linux: { label: 'Linux', emoji: '🐧', url: (v) => `${REPO}/releases/tag/desktop-v${v}` },
  ios: { label: 'App Store', emoji: '🍎', url: () => APP_STORE },
  android: { label: 'Google Play', emoji: '🤖', url: () => PLAY },
  appletv: { label: 'Apple TV', emoji: '🍎', url: () => `${APP_STORE}?platform=appleTV` },
  androidtv: { label: 'Android TV', emoji: '🤖', url: () => PLAY },
  webos: { label: 'LG webOS', emoji: '📡', url: () => 'https://tentacletv.app/webos/' },
  server: { label: 'Docker', emoji: '🐳', url: (v) => `${REPO}/releases/tag/server-v${v}` },
};

export const PRODUCTS = {
  desktop: {
    changelog: 'changelogs/desktop.md', stores: ['macos', 'windows', 'linux'], emoji: '🖥️',
    name: { en: 'Tentacle TV for desktop', fr: 'Tentacle TV pour ordinateur' },
  },
  mobile: {
    changelog: 'changelogs/mobile.md', stores: ['ios', 'android'], emoji: '📱',
    name: { en: 'Tentacle TV for iPhone, iPad & Android', fr: 'Tentacle TV pour iPhone, iPad et Android' },
  },
  tv: {
    changelog: 'changelogs/tv.md', stores: ['appletv', 'androidtv'], emoji: '📺',
    name: { en: 'Tentacle TV for Apple TV & Android TV', fr: 'Tentacle TV pour Apple TV et Android TV' },
  },
  webos: {
    changelog: 'changelogs/webos.md', stores: ['webos'], emoji: '📡',
    name: { en: 'Tentacle TV for LG webOS', fr: 'Tentacle TV pour LG webOS' },
  },
  server: {
    changelog: 'changelogs/server.md', stores: ['server'], emoji: '🐳',
    name: { en: 'Tentacle TV Server', fr: 'Serveur Tentacle TV' },
  },
};

const TEXT = {
  en: { available: 'Available on', more: 'Full release notes', none: 'Release notes on GitHub.' },
  fr: { available: 'Disponible sur', more: 'Notes complètes', none: 'Notes de version sur GitHub.' },
};

/**
 * La version à annoncer pour une plateforme : la plus haute que sert une de ses
 * boutiques AU-DESSUS du seuil de cette boutique. Null s'il n'y a rien de neuf.
 * Une boutique sans seuil n'en a pas : tout ce qu'elle sert compte.
 */
export function targetVersion(product, live, floors = {}) {
  const fresh = product.stores
    .filter((s) => isVersion(live[s]) && !(isVersion(floors[s]) && compareVersions(live[s], floors[s]) <= 0))
    .map((s) => live[s]);
  return maxVersion(fresh);
}

/** Les boutiques de la plateforme qui servent exactement `version`, dans l'ordre du modèle. */
export const storesServing = (product, live, version) => product.stores.filter((s) => live[s] === version);

/** Puces du changelog → puces Discord, gras conservé ; coupe propre sous la limite. */
export function discordNotes(md, fullUrl, lang) {
  if (!md) return TEXT[lang].none;
  const text = md
    .replace(/^(\s*)[-*+]\s+/gm, (_, indent) => (indent.length >= 2 ? '  ◦ ' : '• '))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length <= DESCRIPTION_MAX) return text;
  const tail = `\n…\n[${TEXT[lang].more}](${fullUrl})`;
  const cut = text.slice(0, DESCRIPTION_MAX - tail.length);
  const nl = cut.lastIndexOf('\n');
  return `${(nl > 0 ? cut.slice(0, nl) : cut).trimEnd()}${tail}`;
}

/** Le pied d'un message : lu par `parseAnnouncement`, ne pas changer sa forme. */
export const footerText = (productKey, version) => `Tentacle TV · ${productKey} ${version}`;

/**
 * Le message d'une version, prêt pour l'API Discord. `allowed_mentions` vide :
 * un « @everyone » glissé dans un changelog ne pingue personne.
 */
export function buildAnnouncement({ productKey, version, stores, lang, notesMd, timestamp }) {
  const product = PRODUCTS[productKey];
  const fullUrl = `${REPO}/blob/main/${product.changelog}`;
  return {
    embeds: [
      {
        color: BRAND_COLOR,
        title: `${product.emoji} ${product.name[lang]} ${version}`,
        description: discordNotes(notesMd, fullUrl, lang),
        fields: [
          {
            name: TEXT[lang].available,
            value: stores.map((s) => `${STORES[s].emoji} ${STORES[s].label}`).join('\n'),
          },
        ],
        footer: { text: footerText(productKey, version) },
        ...(timestamp ? { timestamp } : {}),
      },
    ],
    components: [
      {
        type: 1,
        components: stores.map((s) => ({
          type: 2, style: 5, label: STORES[s].label, url: STORES[s].url(version), emoji: { name: STORES[s].emoji },
        })),
      },
    ],
    allowed_mentions: { parse: [] },
  };
}

/** Relit un message du bot : { productKey, version, stores, timestamp } ou null s'il n'en est pas un. */
export function parseAnnouncement(message) {
  const embed = message?.embeds?.[0];
  const m = String(embed?.footer?.text ?? '').match(/^Tentacle TV · ([a-z]+) (\d+\.\d+\.\d+)$/);
  if (!m || !PRODUCTS[m[1]]) return null;
  const product = PRODUCTS[m[1]];
  const labels = (message.components ?? []).flatMap((row) => row.components ?? []).map((c) => c.label);
  const stores = product.stores.filter((s) => labels.includes(STORES[s].label));
  return { productKey: m[1], version: m[2], stores, timestamp: embed.timestamp ?? null };
}

/** Réunion de deux listes de boutiques, dans l'ordre du modèle. */
export const mergeStores = (productKey, a, b) => PRODUCTS[productKey].stores.filter((s) => a.includes(s) || b.includes(s));
