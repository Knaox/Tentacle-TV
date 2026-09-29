// Ce que Google Play SERT réellement, par l'API de rapports (Play Developer
// Reporting v1beta1, `apps.fetchReleaseFilterOptions`) — LECTURE SEULE.
//
// POURQUOI PAS androidpublisher. Y lire une piste exige d'ouvrir une
// « édition » (edits.insert), et une édition ouverte pendant qu'un workflow
// publie peut invalider la sienne : les éditions Play concurrentes
// s'invalident (voir CLAUDE.md). Un veilleur qui tourne toutes les trente
// minutes finirait par croiser une publication. L'API de rapports n'ouvre
// rien : elle liste, par piste, les releases ACTIVES et leurs versionCodes.
//
// POURQUOI UN SCOPE À PART. Le compte de service peut publier. Le jeton demandé
// ici ne porte que `playdeveloperreporting` : même intercepté, il ne publie,
// ne promeut et ne retire rien.
//
// Prérequis côté Google : l'API « Google Play Developer Reporting » activée
// dans le projet Cloud du compte de service. Sans elle, l'appel rend 403 et le
// veilleur retombe sur la fiche publique pour le téléphone (lib/store-listings).
import { mintToken } from './play-api.mjs';
import { maxVersion } from './versions.mjs';

const SCOPE = 'https://www.googleapis.com/auth/playdeveloperreporting';
const API = 'https://playdeveloperreporting.googleapis.com/v1beta1';

/** Android TV et le téléphone partagent la fiche : la TV se reconnaît à son versionCode (2e9 + build). */
export const TV_VERSION_CODE_BASE = 2_000_000_000;

/** Les pistes de l'app et leurs releases actives. Lève sur un refus (403 si l'API n'est pas activée). */
export async function fetchReleaseTracks(serviceAccountJson, pkg) {
  const token = await mintToken(JSON.parse(serviceAccountJson), SCOPE);
  const r = await fetch(`${API}/apps/${encodeURIComponent(pkg)}:fetchReleaseFilterOptions`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const why = [j.error?.status, j.error?.message].filter(Boolean).join(' — ');
    throw new Error(`fetchReleaseFilterOptions → ${r.status}${why ? ` ${why}` : ''}`);
  }
  return Array.isArray(j.tracks) ? j.tracks : [];
}

/**
 * Les versions servies en PRODUCTION, téléphone et TV séparés.
 *
 * La version est le nom de la release, que play-publish.mjs pose à la version
 * marketing (« 1.8.1 »). Une release dont les versionCodes mêlent téléphone et
 * TV, ou dont le nom ne contient pas de version, est ignorée plutôt que devinée.
 */
export function productionVersions(tracks) {
  const phone = [];
  const tv = [];
  for (const track of tracks ?? []) {
    if (!/production/i.test(`${track?.type ?? ''} ${track?.displayName ?? ''}`)) continue;
    for (const rel of track.servingReleases ?? []) {
      const version = String(rel?.displayName ?? '').match(/\b\d+\.\d+\.\d+\b/)?.[0];
      const codes = (rel?.versionCodes ?? []).map(Number).filter(Number.isFinite);
      if (!version || codes.length === 0) continue;
      if (codes.every((c) => c >= TV_VERSION_CODE_BASE)) tv.push(version);
      else if (codes.every((c) => c < TV_VERSION_CODE_BASE)) phone.push(version);
    }
  }
  return { phone: maxVersion(phone), tv: maxVersion(tv) };
}

/** Une ligne lisible par piste, pour le journal du veilleur. */
export const describeTracks = (tracks) =>
  (tracks ?? []).map((t) => {
    const rels = (t.servingReleases ?? [])
      .map((r) => `${r.displayName ?? '?'} [${(r.versionCodes ?? []).join(', ')}]`)
      .join(' ; ');
    return `${t.type ?? '?'} « ${t.displayName ?? '?'} » : ${rels || 'aucune release active'}`;
  });
