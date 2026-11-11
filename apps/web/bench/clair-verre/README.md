# Banc « clair-verre » — le contraste et le verre, mesurés sur une instance réelle

Jamais lancé par `pnpm test`. Il lit une instance qui tourne (un backend, le client de dev) avec la
session d'un compte de BANC, posée par ses jetons d'appareil — jamais un mot de passe, jamais un
autre compte. Tout se lance depuis `apps/web`.

```bash
# L'instance (ports de l'axe ; n'importe lesquels avec BANC_ORIGIN) :
#   backend  : TENTACLE_DATA_DIR=<copie> PORT=3413 HOST=127.0.0.1 REMOTE_CHECK_URL=off pnpm exec tsx src/index.ts
#   client   : TENTACLE_DEV_API=http://127.0.0.1:3413 pnpm exec vite --port 5413 --strictPort
#   jetons   : BANC_TOKENS=<fichier> — { "<compte>": { "token": "…", "user": { "Id": "…", "Name": "…" } } }

node bench/clair-verre/audit.mjs <dossier>                 # le thème clair, tous les écrans
THEME=dark node bench/clair-verre/audit.mjs <dossier>      # le sombre
node bench/clair-verre/resume.mjs <dossier>/rapport.json   # les défauts par ENCRE : quel jeton corriger
node bench/clair-verre/pire-image.mjs /library/<id>        # le texte posé sur une image blanche, puis noire
node bench/clair-verre/capture.mjs <fichier.png> <route>   # regarder un écran
```

## Ce que la mesure fait

Le texte et les pictogrammes sont rendus invisibles, la page est capturée — son FOND seul : aplats,
dégradés, images, verre, voiles —, puis chaque texte est comparé aux pixels qu'il recouvre, en vingt
et un points. Aucune hypothèse sur l'empilement. Seuils WCAG : 4,5:1 pour le texte ; 3:1 pour un
grand texte (24 px, ou 18,66 px en gras) et un pictogramme.

Écartés, parce qu'ils ne se lisent pas ou ne sont pas l'interface : un texte rogné par un ancêtre,
recouvert par un calque flottant (barre fixe, menu, modale), posé sous une image (des initiales de
repli sous un portrait), un contrôle inactif, un séparateur « · », le compteur d'images et le bouton
DEBUG du paquet de développement. Une page qui bouge encore est remesurée.

Les écrans : `scenes.mjs`. Les identifiants (bibliothèques, fiches, personne) sont lus sur
l'instance et gardés dans `~/.cache/tentacle-test/rf2/clair-verre/scenes.json` (`BANC_SCENES`).
Ce qu'un compte sans droits n'atteint pas — l'administration, « Qui regarde ? », l'assistant, les
avis — passe par les labos `/dev/*` du paquet de développement.

## Le Liquid Glass

```bash
GLASS=1 BANC_NAVIGATEUR=complet node bench/clair-verre/audit.mjs <dossier>          # pont de la coquille SIMULÉ
BANC_NAVIGATEUR=complet node bench/clair-verre/coins.mjs                              # les angles des formes de verre
```

`GLASS=1` simule le pont de la coquille (macOS 26, verre « supporté ») : la part du verre que la
PAGE peint — givre, courbe de tons, lentille — se rend dans un Chrome ordinaire ; l'échantillonneur
de ton est branché sur une capture, comme dans la coquille.

⚠️ **`BANC_NAVIGATEUR=complet`** pour juger un verre : le « headless shell » ne givre pas toute une
grande surface en densité 2 — une bande nette en bas et à droite d'un menu, qui n'existe ni dans le
Chromium entier ni dans la coquille. Ne pas la prendre pour un défaut de l'app.

## La vraie coquille CEF

```bash
B=~/.cache/tentacle-cef/build/<axe>/Tentacle.app/Contents/MacOS/Tentacle      # scripts/build.sh <axe>
TENTACLE_MUTE=1 "$B" --url=http://127.0.0.1:5413 --profile=<jetable> --user-data=<jetable> \
  --mute --background --devtools-port=9413 --size=1440x900 &
CEF_PID=$! node bench/clair-verre/cef-tour.mjs <dossier> [scène…]             # captures de la FENÊTRE
CEF=1 GLASS=1 THEME=dark node bench/clair-verre/audit.mjs <dossier>           # le contraste, dans la coquille
```

Profils JETABLES, son coupé, fenêtre sans focus. `cef-tour.mjs` capture la fenêtre de l'app
(`screencapture -l`, jamais l'écran) : densité Retina, barres de défilement de CEF, verre natif
compris. C'est là que le « coin non arrondi » d'un menu s'est vu — la piste d'une barre de
défilement, que ni le Chrome sans tête (barres masquées) ni macOS (barres en surimpression) ne
montraient.

Ce que ce banc ne juge PAS : le verre natif du lecteur (régions `NSGlassEffectView`, sous la vue
web) — une fenêtre inactive n'a pas le verre d'une fenêtre active (`docs/LIQUID-GLASS.md`, § 7).
