// L'écran des nouveautés (desktop, après une mise à jour). Les textes des
// nouveautés elles-mêmes suivent, une paire de clés par nouveauté :
// v<version>_<id>_title / _body — clés plates, sans point.
export default {
  title: "Nouveautés",
  subtitleVersion: "Version {{version}}",
  subtitleSince: "Depuis la version {{version}}",
  kindNew: "Nouveau",
  kindImproved: "Amélioré",
  kindFixed: "Corrigé",
  previous: "Précédent",
  next: "Suivant",
  done: "Terminé",
  seeInApp: "Voir dans l'app",
  featureListLabel: "Liste des nouveautés",
  progress: "{{index}} sur {{total}}",
} as const;
