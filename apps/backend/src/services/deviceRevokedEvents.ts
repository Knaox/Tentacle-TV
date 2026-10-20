/**
 * « Cet appareil n'existe plus » — une session de profil de la Famille
 * terminée, un appareil déjumelé : annoncé par la révocation
 * (`deviceRevocation.ts`) à ceux qui tenaient quelque chose pour lui (Watch
 * Together : l'appareil quitte sa salle). Un module à part : la révocation ne
 * connaît pas ses abonnés.
 */

export type DeviceRevokedListener = (userId: string, tokenHash: string) => void;

const listeners = new Set<DeviceRevokedListener>();

export function onDeviceRevoked(listener: DeviceRevokedListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function announceDeviceRevoked(userId: string, tokenHash: string): void {
  for (const listener of listeners) {
    try {
      listener(userId, tokenHash);
    } catch (error) {
      console.error("[révocation] abonné en échec", error);
    }
  }
}
