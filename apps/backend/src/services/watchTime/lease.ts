import { randomUUID } from "node:crypto";
import { getPrisma, hasPrisma } from "../db";

/**
 * Bail d'exclusivité du collecteur : une seule instance mesure à la fois.
 *
 * Le cas qu'on veut empêcher est banal et silencieux : un `pnpm dev` local
 * branché sur la même base qu'une instance en service. Les deux relèveraient les
 * mêmes sessions et créditeraient chacune le même temps — tous les chiffres
 * doublés, sans le moindre message d'erreur.
 *
 * Bail court (45 s), renouvelé à chaque relevé : si le porteur meurt, un autre
 * reprend en moins d'une minute sans intervention.
 */

const CLE = "collector";
const DUREE_MS = 45_000;

/** Identité de CETTE instance, le temps de sa vie. */
export const MOI = randomUUID().slice(0, 8);

/**
 * Prend ou renouvelle le bail. Vrai si cette instance a le droit de mesurer.
 *
 * L'acquisition passe par un `updateMany` conditionnel, atomique côté base :
 * soit la ligne m'appartient déjà, soit elle est périmée. Deux instances qui
 * tentent en même temps : une seule voit `count === 1`.
 */
export async function prendreBail(): Promise<boolean> {
  if (!hasPrisma()) return false;
  const prisma = getPrisma();
  const maintenant = new Date();
  const expire = new Date(maintenant.getTime() + DUREE_MS);

  try {
    const { count } = await prisma.watchTimeLease.updateMany({
      where: { id: CLE, OR: [{ owner: MOI }, { expiresAt: { lt: maintenant } }] },
      data: { owner: MOI, expiresAt: expire },
    });
    if (count === 1) return true;

    // Aucune ligne : premier démarrage. La clé primaire tranche si deux
    // instances créent en même temps — le perdant échoue et réessaiera.
    await prisma.watchTimeLease.create({
      data: { id: CLE, owner: MOI, expiresAt: expire },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Rend le bail à l'arrêt, pour qu'un redémarrage reprenne la mesure tout de
 * suite au lieu d'attendre l'expiration.
 */
export async function libererBail(): Promise<void> {
  if (!hasPrisma()) return;
  try {
    await getPrisma().watchTimeLease.updateMany({
      where: { id: CLE, owner: MOI },
      data: { expiresAt: new Date(0) },
    });
  } catch {
    // Sans conséquence : le bail expirera de lui-même en 45 s.
  }
}
