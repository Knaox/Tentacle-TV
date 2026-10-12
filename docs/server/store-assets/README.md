# Visuels de la fiche Microsoft Store — Tentacle Server

Ce qu'on dépose dans Partner Center (produit **Tentacle Server**, Fiches du Store, une par langue). Règles
de la fiche : [`../windows-store-listing.md`](../windows-store-listing.md) — jamais de logo de Jellyfin,
ni dans les visuels, ni dans les captures (onglets compris).

## Champ Partner Center → fichier

| Champ Partner Center | Fichier | Dimensions |
|---|---|---|
| Logos Windows Store › Image d'affiche 9:16 (logo principal Windows 10/11, Xbox) | `brand/store/server/poster-9x16-720x1080.png` | 720 × 1080 |
| Logos Windows Store › Image d'affiche 9:16 | `brand/store/server/poster-9x16-1440x2160.png` | 1440 × 2160 |
| Logos Windows Store › Image de zone 1:1 | `brand/store/server/tile-1x1-1080x1080.png` | 1080 × 1080 |
| Logos Windows Store › Image de zone 1:1 | `brand/store/server/tile-1x1-2160x2160.png` | 2160 × 2160 |
| Captures d'écran › Bureau (FR) | `fr/01-welcome.png` … `fr/06-recap.png` | 1920 × 1080 |
| Captures d'écran › Bureau (EN) | `en/01-welcome.png` … `en/06-recap.png` | 1920 × 1080 |

Les quatre logos sont des PNG opaques (RVB, sans alpha), tirés de `brand/` — jamais retouchés à la main :

```bash
python3 brand/generate-svg.py brand                          # store-server-poster.svg, store-server-tile.svg
python3 brand/generate-icons.py --write brand/store/server    # les quatre PNG
```

## Les captures (FR et EN, dans cet ordre)

| # | Fichier | Ce qu'on voit | Légende proposée (FR / EN) |
|---|---|---|---|
| 1 | `01-welcome.png` | l'accueil de l'assistant, sans code depuis la maison | Un assistant, une question à la fois / A wizard, one question at a time |
| 2 | `02-jellyfin.png` | l'étape Jellyfin : « Télécharger et installer Jellyfin » | Pas de Jellyfin ? Tentacle propose son installateur officiel / No Jellyfin? Tentacle offers its official installer |
| 3 | `03-jellyfin-install.png` | l'installation suivie en trois étapes, et ce qui bloque d'habitude | L'installation de Jellyfin, suivie pas à pas / Jellyfin's installation, followed step by step |
| 4 | `04-jellyfin-ready.png` | Jellyfin installé, démarré, dans la liste | Jellyfin trouvé, prêt à configurer / Jellyfin found, ready to set up |
| 5 | `05-libraries.png` | les bibliothèques sur `D:\Films`, choisies avec l'Explorateur | Vos dossiers, choisis avec l'Explorateur / Your folders, picked with File Explorer |
| 6 | `06-recap.png` | le récapitulatif avant l'installation | Tout relire, puis installer d'un clic / Review, then install in one click |

Comment elles ont été prises : l'assistant RÉEL du dépôt (serveur et client web de dev), Chrome sans
interface à 1920 × 1080, échelle 1. L'accueil vient du vrai serveur ; à partir de l'étape Jellyfin, les
réponses de `/api/setup/*` propres à l'app Windows (hôte présent, Jellyfin de ce PC absent, installation,
Explorateur) sont SIMULÉES dans le navigateur, sans toucher aucun Jellyfin : le Jellyfin s'appelle
`MEDIA-PC`, l'administrateur `admin`, les dossiers `D:\Films` / `D:\Séries` (`D:\Movies` / `D:\TV Shows`).
Le badge `DEBUG` du client de dev est retiré de l'image. Aucune affiche, aucun logo de Jellyfin, aucune
donnée personnelle.

À refaire sur la vraie app si l'interface change : mêmes écrans, même taille.

## À prendre dans la VM Windows (impossible ici)

Deux captures n'existent que dans l'app installée. VM Windows 11 en **1920 × 1080, échelle 100 %**, thème
sombre, fond d'écran uni sombre, barre des tâches sans autre app épinglée qu'Edge et l'Explorateur, aucune
notification visible. Tentacle Server installé depuis le paquet du Store (ou le vol de test), Jellyfin
installé par l'assistant. Une série par langue : Windows en français pour FR, en anglais pour EN (le
menu suit la langue de Windows).

**7. L'icône et son menu** (`fr/07-tray-menu.png`, `en/07-tray-menu.png`)
1. Le serveur tourne (l'icône près de l'horloge, état « En marche »).
2. Si l'icône est dans le dépassement (`^`), l'épingler d'abord : Paramètres › Personnalisation › Barre des
   tâches › Autres icônes de la barre d'état › Tentacle Server = Activé.
3. Clic droit sur l'icône : le menu s'ouvre au-dessus de la barre des tâches.
4. `Win + Maj + S` › Plein écran, ou `Impr. écran` : l'image entière de 1920 × 1080, menu ouvert.
5. On doit voir : le menu entier (« Ouvrir l'administration », l'état « En marche, port 3000 », « Ouvrir le journal »,
   « Supprimer les données du serveur… », « Quitter »), l'icône de Tentacle Server à côté de l'horloge.
   Rien d'autre d'ouvert ; aucune fenêtre ni icône de Jellyfin visible (masquer son icône de la zone de
   notification le temps de la capture : même réglage qu'à l'étape 2, Jellyfin = Désactivé).

**8. L'écran de démarrage** (`fr/08-startup.png`, `en/08-startup.png`)
1. Quitter Tentacle Server (menu de l'icône › Quitter), puis le relancer depuis Démarrer.
2. Pendant que l'écran de démarrage est affiché (logo du serveur, « Démarrage du serveur… »),
   `Impr. écran`. S'il passe trop vite : l'Outil Capture d'écran, mode « Plein écran » avec minuterie de
   3 s, déclenché juste avant de relancer l'app.
3. On doit voir : la fenêtre de démarrage centrée sur le bureau uni, entière, net ; pas de curseur dessus.

Les deux en PNG 1920 × 1080, déposés dans `fr/` et `en/` à leur numéro, puis ajoutés à Partner Center
après les six autres.

## Restent à faire (pas atteignables ici)

- **Tableau de bord de l'administration** avec la carte « Mise à jour par le Microsoft Store » : il faut un
  serveur installé dans l'app Windows (la carte ne paraît que là) et une bibliothèque de démonstration
  libre de droits — à prendre dans la VM, comme ci-dessus.
- **Accès à distance** (panneau de l'administration, adresses réglées) : même condition.
- **Le résultat** (l'accueil de Tentacle TV sur le bureau ou une TV) : bibliothèque libre de droits
  seulement (Blender Open Movies, par exemple), jamais d'affiche sous droits.
