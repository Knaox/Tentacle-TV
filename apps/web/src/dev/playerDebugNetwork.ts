/**
 * La section « réseau sortant » du panneau de diagnostic.
 *
 * DÉVELOPPEMENT UNIQUEMENT, comme le reste du panneau. Extraite de
 * `playerDebugData.ts` pour tenir la limite de 300 lignes par fichier, et parce
 * qu'elle ne partage rien avec les autres sections : elle ne lit ni mpv ni le
 * natif, seulement ce que la sonde réseau a vu passer.
 */

import type { DebugSection } from "./playerDebugTypes";
import { outgoingRequests, type OutgoingRequest } from "./networkProbe";

function clockTime(at: number): string {
  const d = new Date(at);
  const twoDigits = (n: number): string => String(n).padStart(2, "0");
  return `${twoDigits(d.getHours())}:${twoDigits(d.getMinutes())}:${twoDigits(d.getSeconds())}`;
}

/**
 * Chemin lisible : l'origine tombe, le jeton aussi.
 *
 * ⚠️ Les URL de sous-titres de Jellyfin portent la clé d'API EN QUERY. Ce
 * panneau se photographie et se colle dans une conversation — la masquer ici
 * évite qu'elle voyage avec la capture.
 */
function path(url: string): string {
  let short = url;
  try {
    const u = new URL(url);
    short = u.pathname + u.search;
  } catch {
    /* URL relative : déjà un chemin */
  }
  short = short.replace(/([?&](api_key|token|X-Emby-Token)=)[^&]*/gi, "$1***");
  return short.length > 88 ? `${short.slice(0, 87)}…` : short;
}

function faulty(r: OutgoingRequest): boolean {
  return r.failed || (r.status !== null && r.status >= 400);
}

function state(r: OutgoingRequest): string {
  if (r.failed) return `ECHEC RESEAU (${r.durationMs ?? "?"} ms)`;
  if (r.status === null) return "en vol…";
  return `${r.status} · ${r.durationMs ?? "?"} ms`;
}

/**
 * Ce qui est SORTI de la page vers le serveur.
 *
 * Le vide est une information, et c'est même LA réponse qu'on cherche pendant
 * une lecture locale : la touche R remet le journal à zéro juste avant de
 * lancer le film, et ce qui apparaît ensuite est exactement ce que la lecture
 * a provoqué — segments d'intro et d'outro compris.
 */
export function networkSection(): DebugSection {
  const requests = outgoingRequests();
  if (requests.length === 0) {
    return {
      title: "Réseau sortant (R pour vider)",
      lines: [["depuis la remise à zéro", "rien n'est sorti", true]],
    };
  }
  const failures = requests.filter(faulty).length;
  const header: DebugSection["lines"][number] = [
    "depuis la remise à zéro",
    `${requests.length} requête${requests.length > 1 ? "s" : ""}${failures > 0 ? `, ${failures} en échec` : ""}`,
    failures === 0,
  ];
  // Les plus récentes en tête : c'est ce qu'on vient de provoquer qu'on lit.
  const recent = requests
    .slice(-12)
    .reverse()
    .map(
      (r) =>
        [`${clockTime(r.at)} ${r.method}`, `${path(r.url)} → ${state(r)}`, faulty(r) ? false : null] as const,
    );
  return { title: "Réseau sortant (R pour vider)", lines: [header, ...recent] };
}
