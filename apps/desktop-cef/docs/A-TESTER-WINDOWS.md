# À essayer sur une vraie machine Windows (une ligne par cas : geste → attendu)

## navigateur (lot cef-parite)

- Réglages › Profil › « Changer la photo » › « Importer une photo » → boîte « Ouvrir » de Windows, possédée par la fenêtre (elle est désactivée), types « Image Files » puis « All Files (*.*) » ; choisir une image → elle devient la photo.
- Octave › Importer › fichiers audio → boîte « Ouvrir » en sélection multiple, type « Custom Files » ; Annuler → rien ne change.
- Fenêtre étroite › Profil › « Se déconnecter » → TaskDialog titrée « Tentacle TV », boutons OK / Annuler de Windows (traduits) ; Échap = Annuler.
- Si la TaskDialog n'apparaît pas mais une MessageBox classique oui → le manifeste de l'exe n'a pas les Common Controls 6 (axe windows).
- Un lien externe → navigateur par défaut ; un téléchargement lancé par la page → boîte « Enregistrer sous » dans Téléchargements, titre = l'URL ; Annuler → aucun fichier.
- Glisser un fichier audio depuis l'Explorateur sur Octave → la boîte d'import s'ouvre avec ce fichier.
