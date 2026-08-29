import { getPrisma, hasPrisma } from "./db";
import { getConfigValue, setConfigValue } from "./configStore";
import { revokeDeviceByTokenHash } from "./wsManager";
import { TV_PAIRING_EPOCH } from "./version";

/** L'époque déjà appliquée par CE serveur, dans `server_config`. */
export const PAIRING_EPOCH_KEY = "tv_pairing_epoch";

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
export async function applyPairingEpoch(): Promise<void> {
  if (!hasPrisma()) return;

  const raw = getConfigValue(PAIRING_EPOCH_KEY);
  const parsed = raw === undefined ? NaN : Number.parseInt(raw, 10);
  const applied = Number.isFinite(parsed) ? parsed : 0;

  if (TV_PAIRING_EPOCH <= applied) return;

  try {
    const prisma = getPrisma();
    const devices = await prisma.pairedDevice.findMany({
      select: { tokenHash: true },
    });
    for (const device of devices) revokeDeviceByTokenHash(device.tokenHash);

    const { count } = await prisma.pairedDevice.deleteMany({});
    await setConfigValue(PAIRING_EPOCH_KEY, String(TV_PAIRING_EPOCH));

    console.log(
      `[Jumelage] Époque ${applied} → ${TV_PAIRING_EPOCH} : ${count} appareil(s) révoqué(s), rejumelage requis`,
    );
  } catch (err) {
    // Non bloquant, et surtout NON enregistré : le démarrage suivant retentera.
    console.warn(
      `[Jumelage] Époque ${TV_PAIRING_EPOCH} non appliquée :`,
      (err as Error)?.message ?? err,
    );
  }
}
