// La cible Hermes que le banc relève : choisie SANS ambiguïté parmi celles de
// l'inspecteur de Metro (`/json/list`). Un Metro de place peut servir deux apps
// à la fois — vécu le 2026-10-03 (T5) : l'app du simulateur de la place,
// reconnectée au Metro relancé sur le réseau, ET l'app de test sur l'Apple TV ;
// la sonde suivait le simulateur pendant que les gestes partaient à l'appareil.
//
// Règle : seules les pages de l'app attendue (`appId` : com.tentacle.mobile au
// simulateur, com.tentacle.mobile.navtest sur l'appareil), et du nom d'appareil
// attendu s'il est connu ; plusieurs APPAREILS candidats → refus, jamais un
// choix au hasard. Sur un même appareil, la page « React Native Bridge ».

const describe = (page) => ({ appId: page.appId ?? null, deviceName: page.deviceName ?? null, title: page.title ?? null, id: page.id });

/**
 * `{ state: "ready", target }`, `{ state: "waiting" }` (aucune candidate :
 * l'app n'est pas encore connectée) ou `{ state: "ambiguous", candidates }`.
 * `others` : les pages écartées, pour un message d'erreur lisible.
 */
export function selectTarget(list, { appId, deviceName = null }) {
  const pages = (Array.isArray(list) ? list : []).filter((page) => page?.webSocketDebuggerUrl);
  const matching = pages.filter((page) => page.appId === appId && (!deviceName || page.deviceName === deviceName));
  const others = pages.filter((page) => !matching.includes(page)).map(describe);
  const byDevice = new Map();
  for (const page of matching) {
    const device = page.reactNative?.logicalDeviceId ?? page.id;
    byDevice.set(device, [...(byDevice.get(device) ?? []), page]);
  }
  if (byDevice.size === 0) return { state: "waiting", candidates: [], others };
  if (byDevice.size > 1) return { state: "ambiguous", candidates: [...byDevice.values()].map((group) => describe(group[0])), others };
  const [group] = byDevice.values();
  const target = group.find((page) => /React Native Bridge/.test(page.description ?? "")) ?? group[0];
  return { state: "ready", target, candidates: [describe(target)], others };
}

/** Le message d'un refus, lisible par l'auteur du scénario. */
export function ambiguityMessage(selection, { appId, metroPort }) {
  const list = selection.candidates.map((c) => `${c.appId} sur « ${c.deviceName ?? "?"} »`).join(" ; ");
  return `plusieurs cibles Hermes pour ${appId} sur le Metro ${metroPort} (${list}) : le banc refuse de relever plutôt que d'en suivre une au hasard — fermer l'app en trop (rien n'est fermé d'office), ou changer de place`;
}
