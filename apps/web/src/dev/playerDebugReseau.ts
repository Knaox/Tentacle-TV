/**
 * La section « réseau sortant » du panneau de diagnostic.
 *
 * DÉVELOPPEMENT UNIQUEMENT, comme le reste du panneau. Extraite de
 * `playerDebugData.ts` pour tenir la limite de 300 lignes par fichier, et parce
 * qu'elle ne partage rien avec les autres sections : elle ne lit ni mpv ni le
 * natif, seulement ce que la sonde réseau a vu passer.
 */

import type { DebugSection } from "./playerDebugTypes";
import { requetesSortantes, type RequeteSortante } from "./networkProbe";

function heure(at: number): string {
  const d = new Date(at);
  const deuxChiffres = (n: number): string => String(n).padStart(2, "0");
  return `${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}:${deuxChiffres(d.getSeconds())}`;
}

/**
 * Chemin lisible : l'origine tombe, le jeton aussi.
 *
 * ⚠️ Les URL de sous-titres de Jellyfin portent la clé d'API EN QUERY. Ce
 * panneau se photographie et se colle dans une conversation — la masquer ici
 * évite qu'elle voyage avec la capture.
 */
function chemin(url: string): string {
  let court = url;
  try {
    const u = new URL(url);
    court = u.pathname + u.search;
  } catch {
    /* URL relative : déjà un chemin */
  }
  court = court.replace(/([?&](api_key|token|X-Emby-Token)=)[^&]*/gi, "$1***");
  return court.length > 88 ? `${court.slice(0, 87)}…` : court;
}

function fautif(r: RequeteSortante): boolean {
  return r.echec || (r.status !== null && r.status >= 400);
}

function etat(r: RequeteSortante): string {
  if (r.echec) return `ECHEC RESEAU (${r.dureeMs ?? "?"} ms)`;
  if (r.status === null) return "en vol…";
  return `${r.status} · ${r.dureeMs ?? "?"} ms`;
}

/**
 * Ce qui est SORTI de la page vers le serveur.
 *
 * Le vide est une information, et c'est même LA réponse qu'on cherche pendant
 * une lecture locale : la touche R remet le journal à zéro juste avant de
 * lancer le film, et ce qui apparaît ensuite est exactement ce que la lecture
 * a provoqué — segments d'intro et d'outro compris.
 */
export function sectionReseau(): DebugSection {
  const requetes = requetesSortantes();
  if (requetes.length === 0) {
    return {
      titre: "Réseau sortant (R pour vider)",
      lignes: [["depuis la remise à zéro", "rien n'est sorti", true]],
    };
  }
  const echecs = requetes.filter(fautif).length;
  const entete: DebugSection["lignes"][number] = [
    "depuis la remise à zéro",
    `${requetes.length} requête${requetes.length > 1 ? "s" : ""}${echecs > 0 ? `, ${echecs} en échec` : ""}`,
    echecs === 0,
  ];
  // Les plus récentes en tête : c'est ce qu'on vient de provoquer qu'on lit.
  const recentes = requetes
    .slice(-12)
    .reverse()
    .map(
      (r) =>
        [`${heure(r.at)} ${r.methode}`, `${chemin(r.url)} → ${etat(r)}`, fautif(r) ? false : null] as const,
    );
  return { titre: "Réseau sortant (R pour vider)", lignes: [entete, ...recentes] };
}
