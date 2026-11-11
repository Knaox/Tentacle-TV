/**
 * Préférence « Liquid Glass » — réglage par appareil, comme le mode d'apparence.
 *
 * Même clé de stockage que le mobile (`tentacle_liquid_glass`), pour que le
 * vocabulaire reste identique d'une plateforme à l'autre.
 *
 * Défaut ALLUMÉ sur un Mac qui sait poser le verre (1.50.0, Damien le 11/11 : « activé pour tous
 * les Mac qui le supportent, en laissant la possibilité de le désactiver ») — coupé d'office
 * depuis le lot « fl » du 30/10, allumé avant. Ailleurs (web, Windows, Linux, macOS < 26) le
 * défaut reste COUPÉ : rien ne change. Seul l'interrupteur écrit la clé : une valeur gardée est
 * un choix de l'utilisateur, et reste la sienne d'un lancement à l'autre.
 *
 * La bascule de la 1.50.0 vaut UNE fois (`tentacle_liquid_glass_default_on`) : au premier
 * lancement, un « coupé » d'avant est oublié — il datait d'un défaut coupé, pas forcément d'un
 * refus — et le verre s'allume ; coupé ENSUITE, il le reste tant qu'on ne le rallume pas.
 */

export const LIQUID_GLASS_STORAGE_KEY = "tentacle_liquid_glass";
/** Posée quand la bascule de la 1.50.0 a eu lieu sur cet appareil. */
export const LIQUID_GLASS_DEFAULT_ON_MARK = "tentacle_liquid_glass_default_on";

/** Le pont de la coquille dit le verre natif possible ici (macOS 26) : lu sans dépendre de la porte. */
const nativeCapable = (): boolean => {
  try {
    const shell = (window as { tentacle?: { platform?: string; liquidGlass?: { supported?: boolean } } }).tentacle;
    return shell?.platform === "darwin" && shell.liquidGlass?.supported === true;
  } catch {
    return false;
  }
};

/** Le réglage lu dans un stockage : pur, pour les tests. */
export function readLiquidGlass(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">, capable: boolean): boolean {
  if (capable && storage.getItem(LIQUID_GLASS_DEFAULT_ON_MARK) === null) {
    storage.removeItem(LIQUID_GLASS_STORAGE_KEY);
    storage.setItem(LIQUID_GLASS_DEFAULT_ON_MARK, "1");
  }
  const raw = storage.getItem(LIQUID_GLASS_STORAGE_KEY);
  return raw === null ? capable : raw === "true";
}

const read = (): boolean => {
  try {
    return readLiquidGlass(localStorage, nativeCapable());
  } catch {
    return false;
  }
};

let enabled = read();
const listeners = new Set<() => void>();

export const getLiquidGlass = (): boolean => enabled;

export function setLiquidGlass(next: boolean): void {
  enabled = next;
  try {
    localStorage.setItem(LIQUID_GLASS_STORAGE_KEY, String(next));
  } catch {
    /* Persistance impossible : vaut pour la session en cours. */
  }
  for (const l of listeners) l();
}

export function subscribeLiquidGlass(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
