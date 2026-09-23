# Banc de focus — les composants de l'app, sans compte ni serveur

Les vrais composants de l'app TV, alimentés par des données factices, pour
éprouver le D-pad là où l'app elle-même ne s'ouvre pas : un émulateur Android
TV jamais jumelé, un simulateur tvOS. Aucun jeton, aucun identifiant : le
client Jellyfin est une doublure (`fixtures.ts`) et l'utilisateur un
identifiant inventé.

| Scène | Ce qu'elle éprouve |
|---|---|
| Carrousels | l'entrée d'une rangée par sa première carte visible (`RowEntryGuide`), rangées défilées comprises |
| Panneau des épisodes | `TVPlayerEpisodePanel` réel sur l'épisode 41 d'une saison de 60 : ouverture, ligne à ligne, saisons, croix, Retour |
| Filtres de bibliothèque | `TVLibraryFilterBar` + `TVLibraryGrid` + les cinq menus, avec la logique de focus de `LibraryScreen` recopiée |

## Comment l'app charge le banc

L'app de développement ne demande que `index.bundle`. Le relais (`proxy.mjs`,
port 8090) le réécrit en `harness/focus-bench/entry.bundle` et passe tout le
reste à Metro (sondes, HMR, inspecteur). On branche l'app sur le relais au lieu
de Metro ; l'Apple TV physique, elle, continue de parler à Metro directement.

```bash
node apps/tv/harness/focus-bench/proxy.mjs          # Metro doit tourner sur 8081
```

**Android TV (émulateur)** — l'app va chercher `localhost:8081` :

```bash
adb reverse tcp:8081 tcp:8090                        # vers le relais
apps/tv/harness/focus-bench/android.sh restart down down select wait:2 shot:filtres
adb reverse tcp:8081 tcp:8081                        # rendre Metro à l'app
```

**Simulateur tvOS** — l'app lit l'adresse de Metro dans ses préférences :

```bash
xcrun simctl spawn <sim> defaults write com.tentacle.mobile RCT_jsLocation localhost:8090
xcrun simctl launch --terminate-running-process <sim> com.tentacle.mobile
xcrun simctl spawn <sim> defaults delete com.tentacle.mobile RCT_jsLocation   # après
```

On le pilote avec l'agent de `../atv-remote`, compilé pour le simulateur.

## Pièges déjà payés

- **Android ne sort pas d'un ScrollView.** `ReactScrollView.focusSearch`
  (drapeau `enableCustomFocusSearchOnClippedElementsAndroid`, actif par défaut)
  cherche d'abord parmi SES descendants et rend ce qu'il trouve. Depuis un
  élément d'une liste défilante, rien au-dehors n'est atteignable tant qu'un
  candidat existe dedans — `nextFocus*` compris : logcat dit alors
  « couldn't find view with id N ».
- **Android ignore ce qui est recouvert.** Une carte sous un menu reste
  candidate ; seule la distance compte.
- **Un enfant enregistre son Retour AVANT son parent** s'ils naissent dans le
  même rendu (les effets de l'enfant passent d'abord) : le parent, dernier
  inscrit, le vole. Les panneaux s'ouvrent donc après coup, comme dans l'app.
- **L'émulateur rend parfois la main au lanceur** après un arrêt forcé.
  `android.sh` n'envoie aucune touche tant que l'app n'est pas devant : sans
  cette garde, elles partent dans l'accueil Google TV (fiches de films,
  location, achat).
- Le bandeau LogBox est masqué : les messages sont dans logcat
  (`ReactNativeJS`), ou dans la console de l'inspecteur.

## Constat ouvert : le menu des années

`TVYearMenu` n'a jamais été atteignable au D-pad, ni sur tvOS ni sur Android.
Il ne prend pas le focus à l'ouverture (pas de clavier sans geste), et depuis
sa pastille « bas » atteint la carte de la grille SOUS le menu : la géométrie
la préfère aux champs sur les deux plateformes, et Android ne sortirait de
toute façon pas du ScrollView. Même comportement avant et après l'en-tête à
croix — vérifié au banc sur l'ancienne version du menu. Un `nextFocusDown`
posé sur la pastille n'y change rien (ni tvOS, ni Android). Il faut repenser
l'entrée du menu : Android n'offre pas de focus préféré sur un champ texte.
