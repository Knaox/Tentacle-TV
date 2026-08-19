import { getPrisma, hasPrisma } from "./db";
import { hashToken } from "./jwt";

/**
 * Le nom d'un appareil jumelé, déduit de ce qu'il annonce déjà à Jellyfin.
 *
 * # Pourquoi il faut le déduire
 *
 * Le flux relais — celui d'Android TV, d'Apple TV et de webOS — délivre son
 * jeton par `POST /tv-token`, appelé par la page qui confirme le code, pas par
 * le téléviseur. Or le relais public ne transporte aucune identité d'appareil :
 * la page ne PEUT pas savoir de quelle marque de téléviseur il s'agit, et la
 * ligne naît donc sous le nom de remplissage « TV ». Trois téléviseurs, trois
 * lignes identiques, et un utilisateur incapable de révoquer le bon.
 *
 * L'information existe pourtant, et depuis toujours : chaque client se présente
 * à Jellyfin par `X-Emby-Authorization`, qui transite par le proxy. webOS s'y
 * annonce « LG TV », tvOS « Apple TV », Android TV « AndroidTV ». Il suffit de
 * la lire — rien à livrer côté téléviseur.
 */

/** Ce que les clients annoncent, et ce qu'on en affiche. */
const ETIQUETTES: Record<string, string> = {
  "LG TV": "LG TV",
  "Apple TV": "Apple TV",
  AndroidTV: "Android TV",
};

/** Noms de remplissage écrits par les flux de jumelage, à remplacer. */
const REMPLISSAGE = new Set(["", "TV", "Provisioning"]);

/**
 * Une seule tentative par jeton et par vie du processus : sans cela, chaque
 * requête du proxy — il y en a des dizaines par écran — coûterait une lecture
 * en base pour ne rien changer.
 */
const vus = new Set<string>();
const PLAFOND_VUS = 2_000;

export function nommerAppareilDepuisEntete(jeton: string | undefined, entete: unknown): void {
  if (!jeton || !hasPrisma() || typeof entete !== "string") return;
  const etiquette = ETIQUETTES[clientAnnonce(entete) ?? ""];
  if (!etiquette) return;

  const empreinte = hashToken(jeton);
  if (vus.has(empreinte)) return;
  if (vus.size >= PLAFOND_VUS) vus.clear();
  vus.add(empreinte);

  void renommer(empreinte, etiquette).catch(() => {
    // Réessayable au prochain passage : l'appareil garde son nom d'origine.
    vus.delete(empreinte);
  });
}

/** `MediaBrowser Client="LG TV", Device="…"` → `LG TV`. */
function clientAnnonce(entete: string): string | null {
  return /Client="([^"]*)"/.exec(entete)?.[1] ?? null;
}

async function renommer(empreinte: string, etiquette: string): Promise<void> {
  const prisma = getPrisma();
  const appareil = await prisma.pairedDevice.findUnique({
    where: { tokenHash: empreinte },
    select: { id: true, name: true, jellyfinUserId: true },
  });
  if (!appareil || !REMPLISSAGE.has(appareil.name)) return;

  const name = await nomDisponible(appareil.jellyfinUserId, etiquette);
  await prisma.pairedDevice.update({ where: { id: appareil.id }, data: { name } });
  console.log(`[Jumelage] Appareil ${appareil.id} nommé « ${name} »`);
}

/**
 * « LG TV », puis « LG TV 2 » — deux téléviseurs de la même marque doivent
 * rester distinguables dans la liste, c'est tout l'objet de l'exercice.
 *
 * Le rang se lit sur les noms déjà pris par CET utilisateur. Deux appareils qui
 * se nomment au même instant peuvent tomber sur le même rang ; le nom n'est pas
 * unique en base, donc rien ne casse, et l'utilisateur reste libre de révoquer
 * celui qu'il ne reconnaît pas.
 */
async function nomDisponible(jellyfinUserId: string, etiquette: string): Promise<string> {
  const prisma = getPrisma();
  const pris = new Set(
    (await prisma.pairedDevice.findMany({
      where: { jellyfinUserId },
      select: { name: true },
    })).map((a: { name: string }) => a.name),
  );
  if (!pris.has(etiquette)) return etiquette;
  for (let rang = 2; rang < 100; rang++) {
    const candidat = `${etiquette} ${rang}`;
    if (!pris.has(candidat)) return candidat;
  }
  return etiquette;
}
