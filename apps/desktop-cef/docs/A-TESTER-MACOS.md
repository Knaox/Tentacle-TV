# À essayer sur le Mac, à la main (lot cef-parite)

Ce que les bancs ne prouvent pas sans le vrai curseur ni le vrai clavier. Une ligne par cas :
geste → attendu (le comportement d'Electron).

## PiP (axe pip)

Lancer `pnpm dev:cef`, ouvrir un film, « Lecture en incrustation » (bouton du lecteur, ou `I`).

- [ ] Survoler le PiP, application au premier plan → les contrôles paraissent ; la souris quitte le PiP → ils s'effacent.
- [ ] Survoler le PiP alors qu'une AUTRE application est au premier plan → les contrôles paraissent aussi (aucun clic).
- [ ] Premier clic sur « Pause » du PiP, Tentacle en arrière-plan → la lecture se met en pause du premier coup.
- [ ] Après un clic dans le PiP, cliquer un bouton de la fenêtre principale → il répond du premier clic (le focus est revenu à la fenêtre principale).
- [ ] Glisser l'image du PiP (flottant) → la fenêtre suit la main, le point saisi reste sous le curseur ; relâcher → elle reste là.
- [ ] Tirer un coin du PiP (poignée de la page) → il grandit ou rétrécit au ratio de l'image, le coin opposé fixe.
- [ ] Tirer un BORD ou un coin extérieur (zone du système, ~4 à 8 points) → le curseur de redimensionnement paraît sans clic ; le ratio et les bornes tiennent (256 × 144 au moins, 60 % de l'écran au plus).
- [ ] Molette / pincement du pavé sur le PiP → la taille glisse, le coin le plus proche du bord reste fixe.
- [ ] Double-clic sur l'image → retour au lecteur, l'image regagne sa place sans saut.
- [ ] Ancré, réduire la fenêtre principale dans le Dock → le PiP disparaît ; la rouvrir → il revient à son coin.
- [ ] Ancré, déplacer ou redimensionner la fenêtre principale → le PiP la suit, collé à son coin bas-droit.
- [ ] Flottant, passer la fenêtre principale en plein écran puis changer de bureau → le PiP reste visible, au-dessus.
- [ ] Ancré, Tentacle en arrière-plan sous une autre application → l'autre application couvre aussi le PiP.
- [ ] Deux écrans d'échelles différentes : le PiP glissé sur l'autre écran → image nette, cadre à la bonne taille.
- [ ] Cmd+Q pendant le PiP → l'app se ferme sans boîte d'erreur ; relancée, aucune lecture fantôme.
- [ ] « Réduire les animations » (Réglages › Accessibilité › Affichage) → le PiP entre et revient sans animation.
- [ ] PiP d'une vidéo HDR10 / Dolby Vision → l'image reste en HDR (plus lumineuse que l'interface), comme dans le lecteur.
