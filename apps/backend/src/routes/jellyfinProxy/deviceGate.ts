import type { DeviceTokenPayload } from "../../services/jwt";
import { devicePhotoAllowed } from "../../services/avatars/devicePhotoAllowed";
import { deviceRefusal } from "./deviceGuard";
import { devicePhotoRefusal } from "./devicePhotoGuard";

/**
 * Tout ce qu'un jeton d'APPAREIL ne fait jamais par le proxy, en une porte :
 * parler pour un autre compte, écrire hors de ses données (`deviceGuard.ts`),
 * et — pour le compte de démonstration — changer sa photo
 * (`devicePhotoGuard.ts`). `null` : la requête passe ; sinon la raison (403).
 */
export async function deviceGate(
  method: string,
  path: string,
  payload: Pick<DeviceTokenPayload, "userId" | "pairingId">,
  query: Record<string, unknown> | undefined,
): Promise<string | null> {
  return deviceRefusal(method, path, payload.userId, query)
    ?? (await devicePhotoRefusal(method, path, () => devicePhotoAllowed(payload)));
}
