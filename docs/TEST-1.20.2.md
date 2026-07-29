# Plan de test — 1.20.2

Dix commits sur `feat/migration-electron`, rien poussé. `pnpm typecheck` passe
sur les 11 paquets, 487 tests verts, build de production OK.

## 0. Avant de lancer quoi que ce soit

```bash
cd apps/backend && pnpm db:push
```

**Obligatoire** : la mémorisation des langues par contenu ajoute une table
(`item_track_preferences`). Sans cette commande, tout appel au lecteur renverra
une erreur Prisma. Docker doit tourner (`pnpm docker:up`).

---

## 1. L'effet de survol des cartes — le plus visible

Accueil, souris, écran ≥ 1024 px. En thème **sombre** puis en thème **clair**.

- [ ] Survoler une affiche : elle **monte et grandit**, et se détache du fond par
      une ombre diffuse. **Aucun trait, aucun liseré, aucun grain** sur son
      pourtour. C'est le point de départ de toute la demande.
- [ ] L'ombre est visible **des quatre côtés**, pas seulement à gauche et en bas.
      Si elle est coupée à droite par la carte voisine, le `z-index` de survol
      n'est pas appliqué.
- [ ] Le haut de la carte survolée **n'est pas coupé net** par le bord de la
      rangée. Vérifier surtout sur la première rangée de l'accueil.
- [ ] L'écart entre le titre d'une rangée et ses cartes est **inchangé** (il a été
      redistribué : `pt-8` sur le scroller, `mb-1` sur le titre).
- [ ] Deux cartes voisines survolées à la suite : l'ombre de l'une **ne touche
      jamais** l'autre.
- [ ] En 1920 px de large, survoler une vignette 16:9 de « Reprendre » : elle ne
      doit pas non plus toucher sa voisine.
- [ ] Réglages système → animations réduites : plus aucun mouvement au survol.

> Si le liseré est **toujours là** : vérifier qu'aucun `shadow.cardHover` n'est
> enregistré dans l'éditeur de thème admin. Un jeton stocké en base est écrit en
> ligne sur `<html>` et **bat** la feuille de style.

## 2. L'aperçu au survol des cartes horizontales

Rangées « Reprendre la lecture » et « Prochains épisodes ».

- [ ] Le panneau s'ouvre **plus vite** qu'avant (70 ms au lieu de 110).
- [ ] Traverser toute la rangée d'un geste rapide : **aucun** panneau ne s'ouvre.
- [ ] Panneau ouvert : le titre de la carte **n'apparaît plus deux fois** (une fois
      dans le panneau, une fois sous la carte).
- [ ] Descendre la page pour qu'une carte se retrouve **en bas de l'écran**, puis
      la survoler : le panneau se pose **sur toute la carte**, bloc titre compris,
      et non plus sur l'image seule en laissant une bande nue dessous.
- [ ] Dans ce mode, l'image **n'est pas déformée ni recadrée** : elle reste au même
      cadrage que la carte.
- [ ] Survoler la **première** carte d'une rangée, puis la **dernière** visible :
      elles doivent se comporter comme les autres (déroulé vers le bas quand il y
      a la place). C'était le bug sub-pixel : elles basculaient au hasard en mode
      resserré.
- [ ] Faire défiler la page avec la souris posée sur une carte : le panneau
      **suit** sa carte, puis disparaît net quand on défile la rangée.

## 3. La mémoire — le gros du chantier

- [ ] Accueil, faire défiler une rangée jusqu'au bout puis revenir : les cartes
      apparaissent **sans cascade ni clignotement**. Une carte qui revient à
      l'écran ne doit pas attendre avant de s'afficher.
- [ ] Le défilement d'une rangée reste **fluide** et s'arrête sur des cartes
      entières (accroche).
- [ ] Les **flèches** de défilement apparaissent et disparaissent au bon moment,
      aux deux extrémités.
- [ ] Défiler une rangée vers la droite, descendre la page, remonter : la rangée
      est **restée là où on l'avait laissée** (position de défilement conservée).
- [ ] Ma liste et Favoris : le défilement est fluide sur une longue liste, les
      affiches ont **la même apparence** que sur l'accueil.
- [ ] Ma liste : **sélection multiple**, « tout sélectionner », puis retirer
      plusieurs titres. La sélection doit survivre au défilement (les cellules
      hors écran sont démontées).
- [ ] ⚠️ **Changement visuel assumé** : la grille passe de 6 à 7 colonnes en
      1440 px, pour s'aligner sur la grille de bibliothèque. Dites-moi si ça ne
      vous plaît pas.
- [ ] Survoler une affiche : les boutons d'angle (œil / cœur / +) et la barre du
      bas apparaissent **en fondu**, et disparaissent en fondu. Ils sont désormais
      montés à la demande.
- [ ] Cliquer le cœur sur une affiche de l'accueil : l'état se met à jour
      **instantanément** sur les autres cartes du même titre.

### Les autres pages à cartes

Même principe, mécanisme différent : la mise en page ne change pas d'un pixel,
seul le contenu des cellules hors du champ est démonté. À vérifier surtout qu'il
n'y a **aucun saut de page** et **aucune case vide** en défilant.

- [ ] **Fiche d'une série, liste d'épisodes** — prendre une saison longue (un
      anime de 100+ épisodes si vous en avez). Défiler de haut en bas puis
      remonter : les lignes apparaissent sans à-coup, la barre de défilement ne
      change pas de course, et **la sélection multiple d'épisodes survit** au
      défilement (« Sélectionner », cocher en haut, défiler tout en bas, cocher,
      remonter : les deux sont toujours cochés).
- [ ] **Catalogue hors ligne** (desktop, mode Hors ligne) : films et séries,
      défilement fluide, pas de case vide.
- [ ] **Une série hors ligne** : ses épisodes, même vérification.
- [ ] **Une liste partagée** (`/share/<jeton>`) : défilement, et la sélection
      pour ajouter à sa liste survit au défilement.
- [ ] La recherche globale n'a pas été touchée (plafonnée à 24 résultats) —
      vérifier juste qu'elle fonctionne toujours.

**Mesure**, sur un **build de production** (pas `dev:web` — son compteur
d'images tient une boucle permanente qui fausse tout) :

```bash
sudo powermetrics --samplers gpu_power -i 1000 -n 10
```

Attendu : l'accueil ne doit plus monter que ~44 cartes au lieu de ~124, et ce
chiffre ne doit **plus dépendre du nombre de bibliothèques** de votre serveur.
Le vérifier dans l'inspecteur : compter les `.media-tile` du DOM.

## 4. La langue retenue par contenu

- [ ] Lancer un **film**, ouvrir les réglages du lecteur, passer en anglais
      sous-titré français. Quitter.
- [ ] Relancer **le même film** : il repart en anglais sous-titré français, même
      si vos préférences générales disent VF.
- [ ] Lancer un **autre** film : il repart sur vos préférences générales (VF).
      C'est le test qui prouve que la mémorisation est bien par contenu.
- [ ] Même chose sur un **épisode** : le choix ne doit valoir que pour cet
      épisode-là, pas pour toute la série.
- [ ] La case **« Appliquer à cette série »** fonctionne toujours : la cocher sur
      un épisode, puis lancer un épisode **jamais vu** de la même série → il
      prend le choix de la série.
- [ ] Choisir des sous-titres **forcés**, quitter, relancer : ils doivent revenir
      en forcés, pas en sous-titres complets (l'ancienne case dégradait ce mode).
- [ ] Deux comptes différents sur le même serveur : leurs choix ne se mélangent
      pas.
- [ ] **Hors ligne** : rendre un titre disponible hors connexion, le lire, changer
      de langue, quitter. Couper le serveur, relire le titre → le choix est
      retrouvé.
- [ ] Mobile et Android TV **doivent continuer de fonctionner à l'identique** :
      ils n'envoient pas encore l'identifiant du contenu, l'API est
      rétrocompatible. Un test de lecture sur chacun suffit.

## 5. La mise à jour

### En développement, sur macOS (`pnpm --filter @tentacle-tv/desktop-electron dev`)

> Tuer l'app installée d'abord, sinon la coquille de dev quitte sans fenêtre.

- [ ] **F9** ouvre le panneau de diagnostic, la touche **U** est listée
      (« U · pop-up de mise à jour »).
- [ ] Appuyer sur **U** : la **vraie** pop-up s'affiche, pastille v9.9.9, notes,
      bouton « Ouvrir l'App Store ».
- [ ] Cliquer le bouton : **l'application App Store s'ouvre pour de vrai**, sur la
      fiche de Tentacle TV. Pas un navigateur, pas une page web.
- [ ] Le message « L'App Store est ouvert — cliquez sur Mettre à jour » s'affiche
      ensuite sous les boutons.
- [ ] « Plus tard » referme la pop-up.

### Sur Windows (paquet MSIX installé depuis le Store — c'est le seul cas où le vrai flux existe)

- [ ] Quand une mise à jour est en attente, la pop-up apparaît comme avant.
- [ ] Cliquer « Mettre à jour » : la barre **balaie de gauche à droite** en
      continu, avec le texte « Téléchargement par le Microsoft Store… ». Elle ne
      reste plus plantée à 0 %.
- [ ] À la fin : installation, puis redémarrage. Le comportement d'installation
      lui-même **ne doit pas avoir changé** (rien n'a été touché dans la couche
      WinRT).
- [ ] Si l'installation échoue, le message affiché est **en français lisible** et
      non « Error: store-page-opened ».
- [ ] En développement Windows, la touche **U** doit jouer le déroulé complet
      (barre indéterminée → installation → redémarrage) **sans** rien installer ni
      redémarrer.

## 5 bis. Le diagnostic sur macOS

Panneau **F9**, pendant une lecture HDR sur un écran capable (XDR, ou un écran
externe HDR). Aucun comportement du HDR n'a été touché — uniquement ce que le
panneau affiche.

- [ ] La section s'appelle désormais **« Fenêtre Chromium (ne décrit PAS la
      vidéo) »** et ses lignes `dynamic-range` / `color-gamut` n'ont **plus de
      croix rouge**. Elles disaient `standard` en permanence pendant une lecture
      HDR parfaite, parce qu'elles décrivent la fenêtre de la page et non la
      NSWindow de la vidéo.
- [ ] **« HDR — état natif » remonte au-dessus** d'elle, et comporte quatre lignes
      au lieu de deux :
      « plage étendue accordée (instantané) », « écran capable EDR »,
      « bascule d'écran : sans objet (macOS) », « transmission HDR autorisée ».
- [ ] La ligne « plage étendue accordée » **peut dire non sur une scène sombre**
      sans que ce soit un défaut : elle est instantanée et dépend de l'image. Elle
      ne porte plus de verdict. C'est « couche Metal » et le verdict HDR du haut
      qui font foi.
- [ ] La ligne « écran » donne les **deux** résolutions : points CSS et pixels
      réels (1512x982 pts · 3024x1964 px sur un 14 pouces, par exemple).
- [ ] Touche **H** : le retour annonce « transmission HDR autorisée / interdite »
      et « aucun interrupteur d'écran sur ce système ». Il annonçait avant un état
      d'écran qui n'existe pas sur macOS.
- [ ] ⚠️ **Et surtout : le HDR se comporte exactement comme avant.** Relancer la
      même lecture qu'avant cette version et comparer — le verdict du haut, la
      couche Metal et l'EDR de la sonde doivent donner les mêmes valeurs.

## 6. Publication

Une fois les tests ci-dessus passés :

```bash
git push origin feat/migration-electron
```

Puis, quand vous voudrez livrer (depuis `main`) :

```bash
git tag desktop-v1.20.2 && git push origin main desktop-v1.20.2
```

- [ ] Vérifier dans les journaux de la CI que le job `manifest-stores` annonce
      bien `mac FR 1595c / EN 1512c` — c'est le canal `mac` corrigé.
- [ ] Vérifier sur App Store Connect que les notes macOS **ne contiennent pas** le
      mot « téléchargement » (bloc `## [mac-1.20.2]`, fusion de 1.20.0 + 1.20.1 +
      1.20.2).

---

## Ce que je n'ai pas livré, et pourquoi

**La CI macOS ne passe pas sur Electron.** Vous l'avez demandé, et je me suis
arrêté sur un obstacle en amont, que le code documente lui-même :
`apps/desktop-electron/src/main/video/mpvFfi.ts` charge mpv depuis
`/opt/homebrew/lib/libmpv.2.dylib` sur tout ce qui n'est pas Windows — un chemin
qui n'existe que sur une machine de développement. `scripts/package.mjs` est
win32 uniquement (zéro référence à darwin). Empaqueter la coquille macOS
aujourd'hui produirait une app qui **s'installe et ne lit rien**, et Apple la
verrait avant vous.

Le commentaire de ce fichier le dit dans ces termes : « Assembler une chaîne 0.41
vendorée et signée est un chantier de packaging à part entière, qui reste à faire
avant toute livraison. »

Ce qu'il faudrait, dans l'ordre :

1. construire libmpv 0.41 + FFmpeg 62 + rubberband + libarchive pour **arm64 et
   x86_64**, relocalisées en `@loader_path` ;
2. les poser dans `Contents/Frameworks` et les signer inside-out ;
3. trois plists d'entitlements MAS : le parent (sandbox, `network.client`,
   `network.server`, identité d'app) et l'héritage `com.apple.security.inherit`
   pour les quatre Helpers d'Electron ;
4. `@electron/packager` en `platform: "mas"`, `@electron/universal`,
   `@electron/osx-sign`, `productbuild` ;
5. **valider le mode hors ligne sous App Sandbox** — le serveur loopback des
   affiches locales exige `network.server`, ce que la version Tauri déclare déjà.

Le chemin Tauri, lui, est complet et éprouvé
(`apps/desktop/scripts/package-appstore-universal.sh` fait déjà lipo +
Frameworks + profil + signature + `.pkg`) : c'est le modèle à reprendre, et il
reste la cible macOS de la 1.20.2 en attendant.

Tout le reste du chantier « mise à jour » est en place et indépendant de ça : le
jour où le paquet macOS Electron existera, la pop-up et le bouton fonctionneront
sans une ligne de plus.

## Deux remarques

- **Notes de version** : vous m'avez donné trois points pour la 1.20.2
  (interface, bugs mineurs, mémoire) et je m'y suis tenu. Mais la mémorisation
  de la langue par contenu est une **vraie nouveauté visible** livrée dans cette
  version, et elle n'est mentionnée nulle part. Dites-moi si vous voulez une
  quatrième puce.
- **`updates/store-versions.json` n'a pas été touché**, volontairement : c'est la
  CI qui le patche au tag, et le veilleur `store-watch.yml` seulement quand Apple
  passe la version en vente. Le pré-remplir aurait annoncé à vos utilisateurs une
  mise à jour pas encore en ligne. Son bloc Microsoft Store est encore à 1.17.0 ;
  la CI le corrigera au tag.
