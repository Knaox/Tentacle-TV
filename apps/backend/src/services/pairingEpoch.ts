import { getPrisma, hasPrisma } from "./db";
import { getConfigValue, setConfigValue } from "./configStore";
import { revokeDeviceByTokenHash } from "./wsManager";
import { TV_PAIRING_EPOCH } from "./version";

/** L'époque déjà appliquée par CE serveur, dans `server_config`. */
export const CLE_EPOQUE_JUMELAGE = "tv_pairing_epoch";

/**
 * Rejumelage général des téléviseurs, armé depuis `versions.json`.
 *
 * # Pourquoi la suppression de la ligne suffit — et pourquoi elle seule suffit
 *
 * Un jeton d'appareil n'expire jamais dans le temps : sa validité tient à la
 * ligne `paired_devices` que `middleware/auth.ts` relit à CHAQUE requête. La
 * supprimer coupe donc l'accès instantanément, sans que le client puisse s'y
 * opposer — c'est une révocation de serveur, pas une demande faite au client.
 *
 * Les clients savent déjà quoi en faire : `routes/authRefresh.ts` répond
 * `401 { revoked: true }` quand le jeton est signé mais la ligne absente, et
 * c'est précisément ce verdict qui autorise les téléviseurs à se déjumeler et à
 * revenir sur l'écran de code (Android TV et Apple TV via `doLogout`, webOS via
 * `terminerSession`). Rien à livrer côté téléviseur, donc.
 *
 * `revokeDeviceByTokenHash` n'est là que pour l'immédiateté : il pousse
 * `session:revoked` sur les sockets ouvertes et les ferme, au lieu d'attendre
 * qu'un appareil resté sur un écran en cache refasse une requête.
 *
 * # Idempotence
 *
 * L'époque appliquée n'est enregistrée qu'APRÈS la révocation : un échec en
 * cours de route laisse le serveur retenter au démarrage suivant. Une fois
 * enregistrée, redémarrer ne redéclenche rien, et redescendre le champ dans
 * `versions.json` non plus — seul un incrément vaut ordre.
 */
export async function appliquerEpoqueJumelage(): Promise<void> {
  if (!hasPrisma()) return;

  const brute = getConfigValue(CLE_EPOQUE_JUMELAGE);
  const analysee = brute === undefined ? NaN : Number.parseInt(brute, 10);
  const appliquee = Number.isFinite(analysee) ? analysee : 0;

  if (TV_PAIRING_EPOCH <= appliquee) return;

  try {
    const prisma = getPrisma();
    const appareils = await prisma.pairedDevice.findMany({
      select: { tokenHash: true },
    });
    for (const appareil of appareils) revokeDeviceByTokenHash(appareil.tokenHash);

    const { count } = await prisma.pairedDevice.deleteMany({});
    await setConfigValue(CLE_EPOQUE_JUMELAGE, String(TV_PAIRING_EPOCH));

    console.log(
      `[Jumelage] Époque ${appliquee} → ${TV_PAIRING_EPOCH} : ${count} appareil(s) révoqué(s), rejumelage requis`,
    );
  } catch (err) {
    // Non bloquant, et surtout NON enregistré : le démarrage suivant retentera.
    console.warn(
      `[Jumelage] Époque ${TV_PAIRING_EPOCH} non appliquée :`,
      (err as Error)?.message ?? err,
    );
  }
}
