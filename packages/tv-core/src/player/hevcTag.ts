/**
 * L'étiquette d'un flux HEVC dans un conteneur MP4 / MOV, telle qu'AVPlayer
 * (Apple TV) la lit — une décision pure, lue par le choix du chemin de
 * lecture (`prismEligible`, tvOS).
 *
 * `hvc1` range les paramètres du flux (VPS/SPS/PPS) dans l'entrée
 * d'échantillon ; `hev1` les laisse dans le flux. AVPlayer ne lit que la
 * première, et `dvh1`, son pendant Dolby Vision : un `hev1` donne une image
 * NOIRE, le son seul, et AUCUNE erreur — rien ne déclenche le moindre repli.
 * Mesuré au simulateur tvOS : un MP4 HEVC 10 bits `hev1` (« On l'appelait
 * Robin des Bois ») reste noir de bout en bout, alors qu'un `hvc1` du même
 * profil (Lucifer S1E1) s'affiche.
 *
 * Une étiquette INCONNUE (un scan Jellyfin ancien ne la renseigne pas) ne
 * prouve rien : elle ne se lit pas telle quelle non plus. PrismCore, lui,
 * réécrit toujours l'entrée en `hvc1`.
 */
export function avPlayerReadsHevcTag(tag: string | null | undefined): boolean {
  const normalized = (tag ?? "").trim().toLowerCase();
  return normalized === "hvc1" || normalized === "dvh1";
}
