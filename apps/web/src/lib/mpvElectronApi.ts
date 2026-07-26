/**
 * Adaptateur mpv pour la coquille Electron.
 *
 * La surface est RIGOUREUSEMENT celle de l'adaptateur macOS — mêmes commandes
 * `mpv_*`, mêmes évènements `mpv://*` — parce que la coquille Electron
 * implémente exactement le contrat que le côté Rust remplit sur macOS. Tout
 * passe déjà par le pont, qui sait vers quel shell router.
 *
 * On ré-exporte plutôt que de recopier : dupliquer soixante lignes pour ne
 * changer qu'un nom de fichier serait précisément ce que la règle de
 * non-duplication interdit. Ce fichier existe pour que le point d'appel dise
 * « Electron » plutôt que « macOS », et pour porter cette explication.
 *
 * Le jour où Electron aurait besoin d'un comportement propre, il se substitue
 * ici sans que le reste du code bouge.
 */
export * from "./mpvMacosApi";
