# Vitrine — visuels App Store (Apple TV) et site, sur contenu libre

Les images de la fiche App Store Apple TV et du site tentacletv.app, tirées
de la VRAIE interface refondue (`src/redesign/`, montée par le banc UI) sur
un catalogue LIBRE : dix titres de Blender Studio (CC BY), images prises sur
Wikimedia Commons, licence vérifiée fichier par fichier.

## En une commande

Depuis `apps/tv/harness/vitrine` :

```bash
node vitrine.mjs all
```

Elle enchaîne, et rejoue tout quand la refonte bouge :

| Étape | Commande seule | Effet |
|---|---|---|
| Sources | `sources [--fetch]` | Vérifie les 43 images libres (`catalog/sources.json`) ; `--fetch` télécharge celles qui manquent. |
| Instantané | `snapshot` | Tire affiches, fonds et vignettes, calcule leur BlurHash, écrit l'instantané du banc en FR et en EN. |
| Banc | `bench [--lang=fr\|en]` | Metro (8614), relais du banc UI (8613) sur l'instantané d'une langue, simulateur « Banc UI TV — vitrine (Claude) » (Apple TV 4K), app relancée. |
| Captures | `capture [--lang=…] [--only=…]` | Chaque écran de `compose/appstore.json`, figé sur son focus, en 3840×2160. |
| Compositions | `compose [--lang=…] [--only=…]` | Images App Store (accroche + écran) et visuels du site, contrôlés (dimensions, RVB sans alpha). |
| Planches | `planches` | Les séries en planches contact, pour relecture. |
| Arrêt | `down [--sim]` | Arrête Metro et le relais lancés par la vitrine (par PID), et le simulateur. |

## Où vont les fichiers

Rien de binaire dans le dépôt. Par défaut (variables `VITRINE_*` pour changer) :

- `~/Desktop/Projet - local/Tentacle-Vitrine/` : `sources/` (images libres),
  `snapshot/{fr,en}` (instantané du banc), `captures/`, `site/{fr,en}`
  (dossier d'attente du site), `planches/`, `CREDITS.md`.
- `~/Desktop/Projet - local/Tentacle-AppStore/appletv/2026-10-refonte/{fr,en}/` :
  la série App Store, À CÔTÉ de l'actuelle (jamais par-dessus), avec ses
  crédits.

## Les règles

- **Contenu libre seulement** : les titres de `catalog/`, rien de la vraie
  bibliothèque (droits ; rejet Apple 5.2.1).
- **Pas de logo de titre** : Blender Studio exclut ses logos de la licence CC.
  L'interface écrit le titre (cas prévu par la refonte).
- **Rien d'inventé** : ni note communautaire, ni avis, ni plateforme de
  streaming, ni photo de personne (distribution en initiales). Seules les
  notes perso du profil de démo — une fonction de l'app.
- **Les accroches vivent ici** (`compose/appstore.json`), écrites dans chaque
  langue, jamais dans l'i18n de l'app.
- **Le banc est à soi** : simulateur créé neuf, ports relus avant d'être
  choisis, processus arrêtés par PID. Chrome sans tête tourne sur un profil
  jetable (`.state/chrome-profile`), jamais le profil réel.
- **App Store** (règle 2.3.3) : l'app en usage, jamais un écran de connexion,
  de jumelage ou de démarrage seul.
