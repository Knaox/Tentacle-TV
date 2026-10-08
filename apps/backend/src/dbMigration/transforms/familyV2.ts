/**
 * La Famille v1 → v2, PENDANT la copie (MariaDB ne se modifie jamais) : la même
 * règle que le bloc v2 de `core-init.sql`, ses étapes dans le même ordre, en
 * TypeScript pur. UNE famille par compte ; chaque personne garde sa famille la
 * plus ANCIENNE ; une famille dont le propriétaire est resté ailleurs y est
 * FUSIONNÉE (membres et invités le suivent). Rejouée sur une base déjà en v2,
 * elle ne change rien.
 *
 * Les lignes sont celles de la CIBLE, déjà converties (dates en millisecondes,
 * booléens en 0/1, colonnes absentes d'une source v1 déjà remplies de leur défaut).
 * Les tables de la Famille sont petites par nature (une ligne par personne) :
 * elles se traitent entières en mémoire.
 */
export type Row = Record<string, unknown>;

export interface FamilyTables {
  families: Row[];
  members: Row[];
  invitations: Row[];
}

export interface FamilyV2Result extends FamilyTables {
  /** Invitations qui ne sont plus en attente : leurs cloches `family_invite` partent. */
  closedInvitationIds: Set<string>;
  /** Lignes de membres sans famille écartées (elles auraient doublé l'unicité). */
  orphansDropped: number;
}

/** `LEFT(s, n)` de MariaDB : n CARACTÈRES, pas n unités UTF-16. */
function leftChars(s: unknown, n: number): string {
  return Array.from(String(s ?? "")).slice(0, n).join("");
}

const str = (v: unknown) => String(v);

export function migrateFamilyToV2(input: FamilyTables, now: number): FamilyV2Result {
  const families = input.families.map((f) => ({ ...f }));
  let members = input.members.map((m) => ({ ...m }));
  const invitations = input.invitations.map((i) => ({ ...i }));
  const familyById = new Map(families.map((f) => [str(f.id), f]));
  const owner = (familyId: unknown) => familyById.get(str(familyId))?.ownerUserId;

  // 1. Le propriétaire a SA ligne (`owner`) : c'est elle qui porte l'unicité.
  for (const f of families) {
    if (members.some((m) => m.familyId === f.id && m.userId === f.ownerUserId)) continue;
    members.push({
      id: `owner-${str(f.id)}`,
      familyId: f.id,
      userId: f.ownerUserId,
      kind: "owner",
      displayName: leftChars(f.ownerName, 100),
      color: f.ownerColor ?? null,
      jellyfinName: null,
      createdBy: null,
      canCreateGuests: 0,
      canRequestTitles: 0,
      createdAt: f.createdAt,
    });
  }

  // 2. Les invités d'avant la v2 ont été créés par le propriétaire de LEUR famille.
  for (const g of members) {
    if (g.kind === "guest" && (g.createdBy === null || g.createdBy === undefined)) {
      const by = owner(g.familyId);
      if (by !== undefined) g.createdBy = by;
    }
  }

  // 3. Un compte dans plusieurs familles garde la plus ancienne (date, puis identifiant).
  const familyKey = (familyId: unknown) => {
    const f = familyById.get(str(familyId));
    return f ? { at: Number(f.createdAt), id: str(f.id) } : null;
  };
  const before = (a: { at: number; id: string }, b: { at: number; id: string }) =>
    a.at !== b.at ? a.at < b.at : a.id.toLowerCase() < b.id.toLowerCase();
  const byUser = new Map<string, Row[]>();
  for (const m of members) {
    if (!familyKey(m.familyId)) continue; // la jointure de MariaDB ignore une famille absente
    const list = byUser.get(str(m.userId)) ?? [];
    list.push(m);
    byUser.set(str(m.userId), list);
  }
  const dropped = new Set<Row>();
  for (const rows of byUser.values()) {
    if (rows.length < 2) continue;
    let keep = familyKey(rows[0].familyId)!;
    for (const r of rows) {
      const k = familyKey(r.familyId)!;
      if (before(k, keep)) keep = k;
    }
    for (const r of rows) if (familyKey(r.familyId)!.id !== keep.id) dropped.add(r);
  }
  members = members.filter((m) => !dropped.has(m));

  // 4. Fusion : une famille dont le propriétaire est dans une autre la rejoint.
  //    Cinq passes, comme le SQL ; chacune lit l'état du début de la passe.
  const elsewhere = (f: Row) => members.find((ex) => ex.userId === f.ownerUserId && ex.familyId !== f.id);
  for (let pass = 0; pass < 5; pass++) {
    const moves = new Map<string, unknown>();
    for (const f of families) {
      const ex = elsewhere(f);
      if (ex) moves.set(str(f.id), ex.familyId);
    }
    if (moves.size === 0) break;
    for (const o of members) {
      const target = moves.get(str(o.familyId));
      if (target !== undefined) o.familyId = target;
    }
  }
  //    Ses invitations en attente sont closes, puis la famille vide disparaît.
  const merged = new Set(families.filter((f) => elsewhere(f)).map((f) => str(f.id)));
  for (const i of invitations) {
    if (i.status === "pending" && merged.has(str(i.familyId))) {
      i.status = "cancelled";
      i.respondedAt = now;
    }
  }
  const keptFamilies = families.filter(
    (f) => !(merged.has(str(f.id)) && !members.some((m) => m.familyId === f.id)),
  );

  // 5. Un compte déjà dans une famille n'en rejoint pas d'autre.
  const inAFamily = new Set(members.filter((m) => m.kind === "owner" || m.kind === "member").map((m) => str(m.userId)));
  for (const i of invitations) {
    if (i.status === "pending" && inAFamily.has(str(i.inviteeUserId))) {
      i.status = "cancelled";
      i.respondedAt = now;
    }
  }

  // 6. L'unicité (un compte, une ligne) : une ligne ORPHELINE (famille absente)
  //    qui la briserait part ; il n'en reste aucune sur une base saine.
  const keptIds = new Set(keptFamilies.map((f) => str(f.id)));
  const seen = new Set<string>();
  let orphansDropped = 0;
  const unique = [...members]
    .sort((a, b) => Number(keptIds.has(str(b.familyId))) - Number(keptIds.has(str(a.familyId))))
    .filter((m) => {
      const dup = seen.has(str(m.userId));
      seen.add(str(m.userId));
      if (dup && !keptIds.has(str(m.familyId))) orphansDropped++;
      return !dup || keptIds.has(str(m.familyId));
    });
  if (unique.length !== new Set(unique.map((m) => str(m.userId))).size) {
    throw new Error("famille : un compte reste dans deux familles après la migration v2");
  }
  const order = new Map(members.map((m, i) => [m, i]));
  unique.sort((a, b) => order.get(a)! - order.get(b)!);

  const closedInvitationIds = new Set(invitations.filter((i) => i.status !== "pending").map((i) => str(i.id)));
  return { families: keptFamilies, members: unique, invitations, closedInvitationIds, orphansDropped };
}
