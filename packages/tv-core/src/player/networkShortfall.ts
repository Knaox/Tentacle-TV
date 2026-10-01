/**
 * Le réseau, MESURÉ, porte-t-il le flux ? — la seule base d'un « la connexion
 * est trop lente » (décision du 2026-10-01 : un serveur qui transcode
 * lentement n'est pas une connexion lente, et le dire envoyait l'utilisateur
 * chercher la panne au mauvais endroit).
 *
 * `measuredBps` : le témoin de débit (BitrateTest de l'api-client, la voie du
 * média) ; `neededBps` : ce que le flux demande — le palier d'un transcodage,
 * ou le débit du fichier lu tel quel. L'écart quand la mesure est SOUS le
 * besoin, sinon `null` : mesure absente ou besoin inconnu compris — on
 * n'accuse jamais le réseau sans l'avoir mesuré.
 */

export interface NetworkShortfall {
  measuredBps: number;
  neededBps: number;
}

export function networkShortfall(measuredBps: number | null, neededBps: number | null): NetworkShortfall | null {
  if (measuredBps == null || neededBps == null || measuredBps <= 0 || neededBps <= 0) return null;
  return measuredBps < neededBps ? { measuredBps, neededBps } : null;
}
