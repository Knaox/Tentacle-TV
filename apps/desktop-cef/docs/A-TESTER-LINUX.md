# À essayer sur une vraie machine Linux (une ligne par cas : geste → attendu)

## navigateur (lot cef-parite)

- Réglages › Profil › « Changer la photo » › « Importer une photo » → le sélecteur de fichiers du bureau (portail XDG : GNOME/KDE) s'ouvre, filtre images ; choisir une image → elle devient la photo.
- Octave › Importer › fichiers audio → le sélecteur s'ouvre en sélection MULTIPLE, filtre audio ; Annuler → rien ne change.
- Fenêtre étroite (< 768 px) › Profil › « Se déconnecter » → boîte GTK « OK » / « Annuler » (libellés traduits par GTK), modale à la fenêtre (X11) ; « Annuler » → rien, « OK » → déconnexion.
- Même geste sous Wayland → la boîte GTK s'ouvre (sans parenté : normal), répond aux clics et au clavier.
- Machine SANS GTK 3 → boîte de SDL à la place (X11 : dessinée par SDL ; Wayland : zenity/kdialog), mêmes réponses.
- Un lien externe (Crédits › un lien) → s'ouvre dans le navigateur par défaut (xdg-open), l'app reste sur sa page.
- Glisser un fichier audio depuis le gestionnaire de fichiers sur Octave → la boîte d'import s'ouvre avec ce fichier.
- Survoler un bouton-icône (Octave, lecteur) sans bouger ½ s → une bulle sombre avec le texte de `title=`, sous le curseur ; un clic la retire. Sans Pango/Cairo : aucune bulle (attendu).
- Survoler la poignée du chat de Watch Together (`cursor-grab`) → une main (approchée : SDL n'a pas de « grab » ; Electron montre la main du thème) ; `cursor: none` pendant la lecture → curseur caché.
