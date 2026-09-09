/**
 * Le partage équitable d'un budget d'octets — « water-filling » à deux
 * niveaux : d'abord entre les comptes, puis, dans chaque compte, entre ses
 * transferts. Nul ne reçoit plus qu'il ne demande, les parts s'égalisent, et
 * ce qu'un demandeur modeste laisse revient aux autres. Une demande
 * `Infinity` veut dire « autant qu'on m'en donne ».
 *
 * Pur : aucune horloge, aucun état — testé seul.
 */

export interface FlowDemand {
  id: number;
  /** Octets demandés pour ce tick ; `Infinity` = affamé. */
  demand: number;
}

export interface UserDemand {
  userId: string;
  flows: FlowDemand[];
}

/**
 * Un niveau de partage : `shares[i] ≤ demands[i]`, somme ≤ `budget`, et les
 * parts des demandeurs non satisfaits sont égales. Terminaison : chaque tour
 * retire de la lice au moins un demandeur saturé, ou tombe sur un budget
 * inférieur au nombre de bouches — un octet chacun, puis stop.
 */
export function waterFill(budget: number, demands: readonly number[]): number[] {
  const shares = new Array<number>(demands.length).fill(0);
  let remaining = Math.max(0, Math.floor(budget));
  let open = demands.flatMap((demand, i) => (demand > 0 ? [i] : []));
  while (remaining > 0 && open.length > 0) {
    const even = Math.floor(remaining / open.length);
    if (even === 0) {
      // Moins d'octets que de bouches : un octet chacun jusqu'à épuisement —
      // un flux qui ne reçoit rien se tairait, et l'aval le prendrait pour mort.
      for (const i of open.slice(0, remaining)) shares[i] += 1;
      break;
    }
    const still: number[] = [];
    for (const i of open) {
      const room = demands[i] - shares[i]; // Infinity − x = Infinity
      const give = Math.min(even, room);
      shares[i] += give;
      remaining -= give;
      if (room > even) still.push(i); // pas saturé : reste en lice
    }
    // Ceux qui ont saturé rendent le reliquat au tour suivant.
    open = still;
  }
  return shares;
}

/** Les octets accordés à chaque transfert (par `id`) pour ce tick. */
export function allocate(budget: number, users: readonly UserDemand[]): Map<number, number> {
  const perUser = waterFill(
    budget,
    users.map((user) => user.flows.reduce((sum, flow) => sum + flow.demand, 0)),
  );
  const grants = new Map<number, number>();
  users.forEach((user, i) => {
    const perFlow = waterFill(perUser[i] ?? 0, user.flows.map((flow) => flow.demand));
    user.flows.forEach((flow, j) => grants.set(flow.id, perFlow[j] ?? 0));
  });
  return grants;
}
