/**
 * Le niveau de journal d'une réponse en erreur de Jellyfin, relayée par le
 * proxy. Une erreur est un AVERTISSEMENT — sauf la photo d'un compte qui n'en a
 * pas : `Users/{id}/Images/…` en 404 est la réponse attendue, et plusieurs
 * applications la demandent sans savoir si elle existe (celles déjà installées
 * comprises). Au banc, ces 404 étaient les seuls avertissements du serveur (34
 * en deux heures pour un compte), et masquaient les vrais.
 */
export type ProxyErrorLevel = "warn" | "debug";

const ACCOUNT_IMAGE = /^Users\/[^/]+\/Images\//i;

export function proxyErrorLevel(status: number, path: string): ProxyErrorLevel {
  return status === 404 && ACCOUNT_IMAGE.test(path) ? "debug" : "warn";
}
