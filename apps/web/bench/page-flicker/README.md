# Banc « scintillement entre deux pages »

Compte, image par image, ce qu'une navigation montre de PARASITE — sur une vraie instance, avec
un vrai compte, dans un Chromium sans tête ou dans la coquille CEF (par son port CDP).

```bash
# depuis apps/web — un build de production, servi devant une instance (backend sur 3412) :
pnpm exec vite build --outDir /tmp/web-dist
node bench/page-flicker/serve.mjs --dist /tmp/web-dist --api http://127.0.0.1:3412 --port 5412 &

# une base neuve n'a ni lecture commencée, ni Ma liste, ni favori :
node bench/page-flicker/prepare.mjs --base http://127.0.0.1:5412 --session <jetons.json>

# une passe (sort en erreur s'il reste une image parasite) :
pnpm bench:page-flicker --base http://127.0.0.1:5412 --session <jetons.json> --theme dark --network fast
# les quatre (sombre et clair × réseau rapide et lent) :
sh bench/page-flicker/all.sh <étiquette> http://127.0.0.1:5412 <jetons.json> <dossier de sortie>
```

`<jetons.json>` : `{ "knaoxtest": { "token": "…", "user": { "Id": "…", "Name": "…" } } }`, hors dépôt.
Le banc pose la session dans la page (stockage et cookie) ; il n'affiche jamais un jeton.

## Ce qu'il mesure

Le parcours (`lib/journey.mjs`) : accueil → bibliothèque → fiche → retour → accueil → fiche →
retour → « Pour vous » → Ma liste → réglages → recherche → accueil, deux tours — le premier est
la PREMIÈRE visite de chaque page, le second une revisite. Pour chaque transition :

- le **screencast** CDP (JPEG de 360 px, chaque image présentée) dit ce que l'écran a montré ;
- la **sonde** (`lib/probe.mjs`), lue en fin d'image, dit ce que le document contenait.

`lib/analyse.mjs` en tire les images parasites :

| Écart | Ce que c'est |
|---|---|
| `éclair` | une image plus sombre ou plus claire que le départ ET l'arrivée (± 3 niveaux sur 255) |
| `recul` | une image qui s'éloigne de l'arrivée après s'en être approchée |
| `vide` | un corps de page uniforme entre deux pages qui ne le sont pas |
| `anneau` | l'anneau d'attente d'une page entière à l'écran |
| `sans page` | aucune page visible |
| `barre` | la barre absente ou estompée alors qu'elle est là au départ et à l'arrivée |
| `retour d'opacité` | une page qui sort et se ravive, une page en place qui retombe |

`tenue` n'est pas un écart : le temps où la page quittée est restée à l'écran pendant que la
suivante se préparait cachée (`routeTransition/RouteExit`).

## Ses limites

- **Chromium sans tête**, pas un écran : le screencast saute des images sous charge (le banc
  refuse de mesurer au-delà d'une charge de 20 et dit le pire écart entre deux images).
- `--network slow` émule la latence et le débit par CDP : pas les pertes ni la gigue d'un vrai lien.
- `/api/trailers/*` n'est jamais relayé (YouTube refuse après ~150 extractions) : les aperçus de
  bande-annonce ne se jouent pas pendant le banc.
- Le verre natif de macOS 26 ne se capture pas par CDP.

## Lire un régime lent

En réseau lent, une passe n'est pas à zéro : passé le plafond d'attente (1 000 ms de données +
300 ms d'images), la page d'arrivée se montre et se complète sous les yeux. `phases.mjs` dit OÙ
tombent les images signalées — pendant la tenue (la page quittée seule à l'écran), pendant le
fondu (la transition elle-même), ou après (un chargement) :

```sh
node bench/page-flicker/phases.mjs <dossier de --out> dark-slow
```

Un recul PENDANT LA TENUE ou LE FONDU en réseau rapide est un défaut de la transition (relevés du
lot « rf2 » : l'affiche qui recouvrait l'habillage de survol à l'envol, l'aperçu d'une carte qui
s'ouvrait pendant l'attente de sa fiche — ce dernier ne se voit que dans la coquille, où les
aperçus tournent : `--cdp http://127.0.0.1:<port> --sign-in --server <backend>`, après une passe
d'échauffement, le premier lancement d'un profil neuf avalant quelques clics).
