/**
 * Les fonds que le lecteur pose SOUS son verre quand il flotte sur l'image,
 * pour un verre DESSINÉ (simulé, enrichi) : il ne floute rien, et un texte vu
 * à travers un panneau se lirait mal (cf. `nav/NavRail`, barre ouverte). Dense
 * pour ce qu'on lit longtemps (panneaux, carte « À suivre », bandeau
 * d'erreur), voilé pour les pastilles d'un instant. Sous le verre natif, le
 * fond commun les remplace (`useNativeGlassBacking`, `glass/glassBacking`).
 */
export const DENSE_BASE = "rgba(10, 10, 14, 0.84)";
export const SOFT_BASE = "rgba(10, 10, 14, 0.5)";
