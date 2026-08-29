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
 *
 * La marque voyage dans `Device="…"`, PAS dans `Client="…"`. Le quatrième
 * argument de `JellyfinClient` s'appelle `deviceName`, et c'est lui que les
 * trois applications de salon renseignent ; `Client` y vaut « Tentacle TV - TV »
 * pour Android TV comme pour tvOS, donc ne distingue rien.
 */

/** Ce que les appareils annoncent, et ce qu'on en affiche. */
const LABELS: Record<string, string> = {
  "LG TV": "LG TV",
  "Apple TV": "Apple TV",
  AndroidTV: "Android TV",
};

/** Noms de remplissage écrits par les flux de jumelage, à remplacer. */
const PLACEHOLDERS = new Set(["", "TV", "Provisioning"]);

/**
 * Une seule tentative par jeton et par vie du processus : sans cela, chaque
 * requête du proxy — il y en a des dizaines par écran — coûterait une lecture
 * en base pour ne rien changer.
 */
const seen = new Set<string>();
const SEEN_CAP = 2_000;

export function nameDeviceFromHeader(token: string | undefined, header: unknown): void {
  if (!token || !hasPrisma() || typeof header !== "string") return;
  const label = LABELS[announcedDevice(header) ?? ""];
  if (!label) return;

  const fingerprint = hashToken(token);
  if (seen.has(fingerprint)) return;
  if (seen.size >= SEEN_CAP) seen.clear();
  seen.add(fingerprint);

  void rename(fingerprint, label).catch(() => {
    // Réessayable au prochain passage : l'appareil garde son nom d'origine.
    seen.delete(fingerprint);
  });
}

/** `MediaBrowser Client="Tentacle TV - TV", Device="AndroidTV", …` → `AndroidTV`. */
function announcedDevice(header: string): string | null {
  return /Device="([^"]*)"/.exec(header)?.[1] ?? null;
}

async function rename(fingerprint: string, label: string): Promise<void> {
  const prisma = getPrisma();
  const device = await prisma.pairedDevice.findUnique({
    where: { tokenHash: fingerprint },
    select: { id: true, name: true, jellyfinUserId: true },
  });
  if (!device || !PLACEHOLDERS.has(device.name)) return;

  const name = await availableName(device.jellyfinUserId, label);
  await prisma.pairedDevice.update({ where: { id: device.id }, data: { name } });
  console.log(`[Jumelage] Appareil ${device.id} nommé « ${name} »`);
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
async function availableName(jellyfinUserId: string, label: string): Promise<string> {
  const prisma = getPrisma();
  const taken = new Set(
    (await prisma.pairedDevice.findMany({
      where: { jellyfinUserId },
      select: { name: true },
    })).map((a: { name: string }) => a.name),
  );
  if (!taken.has(label)) return label;
  for (let rank = 2; rank < 100; rank++) {
    const candidate = `${label} ${rank}`;
    if (!taken.has(candidate)) return candidate;
  }
  return label;
}
