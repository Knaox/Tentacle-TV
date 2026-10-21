# Liquid Glass — le verre de macOS 26 dans le bureau (1.40.0)

Carnet commun du lot « Liquid Glass macOS » (nuit du 21 au 22/10/2026). Chaque
section dit qui la tient ; une section « à écrire » attend la fusion de son
morceau dans `dev`, et se rédige d'après ce qui a été FUSIONNÉ, jamais d'après
un plan.

| Section | Tenue par |
|---------|-----------|
| 1. La règle | lg-livraison |
| 2. Le socle natif | lg-natif |
| 3. Les jetons `--lg-*` | lg-livraison, d'après lg-tokens |
| 4. La primitive | lg-livraison, d'après lg-tokens |
| 5. Mode d'emploi : une nouvelle surface en verre | lg-livraison |
| 6. Le « liquide » : mouvement, reflet, accessibilité | lg-physique |
| 7. Ce qui ne doit jamais casser | tous |
| 8. Livraison : nouveautés, notes, licences | lg-livraison |
| 9. Bancs et mesures | lg-banc |

## 1. La règle

- **Le verre NATIF, ou le rendu d'avant.** Sur macOS 26 (Tahoe) et au-delà, dans
  l'app de bureau, la fenêtre reçoit le vrai verre du système
  (`NSGlassEffectView`, classe PUBLIQUE d'AppKit, pilotée par le pont koffi déjà
  dans le dépôt — aucun module natif de plus) et la page dessine
  ses surfaces pour s'y accorder. Partout ailleurs — web, Windows, Linux, macOS
  d'avant 26, réglage coupé —, **le rendu d'avant, au pixel près** : aucune
  classe, aucun jeton, aucun calque de plus.
- **Activé d'office, coupé dans Réglages › Apparence.** L'option n'existe QUE là
  où le système sait faire : elle est invisible ailleurs, jamais grisée.
- **Fonction purement client.** Aucune capacité serveur : le serveur ne sait
  rien du verre, et un serveur ancien n'y change rien.
- **Les couleurs de marque restent.** Le verre est neutre ; le violet → rose
  vient en TEINTE (bouton principal, onglet actif, progression), jamais en
  aplat derrière le verre.
- **Tout passe par les jetons `--lg-*`** (clair ET sombre) et la primitive ; jamais
  une valeur de flou, de teinte ou de liseré en dur dans une classe.

## 2. Le socle natif

> À écrire par **lg-natif** : `NSGlassEffectView` / `NSGlassEffectContainerView`
> par le pont koffi (`video/objc.ts`) — pourquoi pas `electron-liquid-glass`
> (mesures), la détection de l'OS (comment « supporté » se décide, et ce qui
> le rend faux), le pont du preload (nom, forme, canaux), les régions
> synchronisées au DOM, la fenêtre (transparence, ombre — cf. CLAUDE.md « Coût
> GPU » § 4), le build Mac App Store (API publiques seulement).

## 3. Les jetons `--lg-*`

> À écrire d'après la fusion de **lg-tokens** : la table des jetons
> (`apps/web/src/theme/tokens.css`), leur valeur en clair et en sombre, et le
> sélecteur qui les allume (la racine ne les porte QUE quand le verre est actif).

Ce que la table doit dire, pour chaque jeton : son rôle (flou, saturation,
teinte neutre, teinte de marque, liseré, reflet, ombre, rayon), sa valeur
claire, sa valeur sombre, et qui le consomme.

## 4. La primitive

> À écrire d'après la fusion de **lg-tokens** : le composant `LiquidGlass` et
> son crochet (`packages/ui/src/glass/`), leurs props, ce qu'ils rendent quand
> le verre est coupé (le rendu d'avant, sans enveloppe superflue), et le crochet
> qui dit « verre actif » / « verre supporté ».

## 5. Mode d'emploi : une nouvelle surface en verre

1. **La surface existe déjà sans verre** : son rendu d'avant ne bouge pas. Le
   verre s'ajoute PAR-DESSUS cette version, par la primitive (§ 4), jamais en
   la remplaçant.
2. **Les valeurs viennent des jetons** (§ 3). Un besoin nouveau (une teinte, un
   rayon) devient d'abord un jeton, en clair et en sombre.
3. **Rien de monté qui n'est pas affiché** (CLAUDE.md, « Coût GPU ») : une
   surface révélée au survol se MONTE à la demande ; on n'anime que `transform`
   et `opacity` ; le reflet bouge en `transform`.
4. **L'accessibilité du système est respectée** (§ 6) : « Réduire la
   transparence » rend une surface opaque, « Augmenter le contraste » durcit
   le liseré, le mouvement réduit fige le liquide.
5. **Le lecteur ne perd jamais son HDR** (§ 7) : une surface posée sur la vidéo
   se vérifie par `video-target-params`, avant et après.
6. **Hors macOS 26, rien** : un test le dit — la surface rend exactement le
   balisage d'avant quand le verre est inactif.

## 6. Le « liquide » : mouvement, reflet, accessibilité

> À écrire par **lg-physique** : morphing et fusion des verres, lentille au
> survol et à l'appui, reflet qui suit le pointeur, ressorts ; « Réduire la
> transparence », « Augmenter le contraste », mouvement réduit ; le budget GPU
> mesuré.

## 7. Ce qui ne doit jamais casser

- **Le HDR / EDR du lecteur** : Apple Silicon, fenêtre Metal de mpv SOUS la
  nôtre ; Intel, `NSOpenGLView` dans la nôtre (CLAUDE.md, « macOS — deux
  montages vidéo »). Le verre ne s'interpose jamais entre la vidéo et l'écran
  d'une façon qui ferait passer la sortie en SDR.
- **Le Mac App Store** : aucune API privée dans le build MAS.
- **L'ombre de la fenêtre transparente** : jamais rallumée (CLAUDE.md,
  « Coût GPU » § 4).
- **Le rendu d'avant** hors macOS 26 et réglage coupé.

## 8. Livraison : nouveautés, notes, licences

- **Notes de version** (`changelogs/desktop.md`) : le verre n'existe que sur
  macOS 26, il ne paraît donc QUE dans le bloc `## [mac-1.40.0]` (App Store
  Connect). Le bloc nu `## [1.40.0]` (Microsoft Store, Linux) porte les autres
  nouveautés de la version ; chacune se recopie aussi dans le bloc Mac, sous le
  verre. Jamais un commentaire DANS `### FR` / `### EN` : il partirait chez le
  store.
- **Écran des nouveautés** (`apps/web/src/whatsNew/`) : release `1.40.0`
  (`releases/v1_40_0.tsx`), scènes `scenes/v1_40_0/` — la navigation et le
  lecteur, le verre PEINT par `FauxGlass` (une scène ne peut pas emprunter le
  verre natif). Elles portent `requires: "liquidGlass"` : le filtre `forClient`
  les retire là où l'appareil n'a pas le verre (`clientTraits.ts`), et une
  release ainsi vidée n'ouvre pas d'écran.
- **Licences** : rien à ajouter à `apps/desktop-electron/THIRD-PARTY-LICENSES.md`
  — le verre passe par AppKit et koffi, déjà présents ; le module
  `electron-liquid-glass` n'a pas été retenu (§ 2).

## 9. Bancs et mesures

> À écrire par **lg-banc** : comment lancer le banc Electron du verre (CDP,
> captures de fenêtre), les mesures `powermetrics` de référence (au repos, en
> lecture, verre allumé et coupé), et la recette d'une fusion.
