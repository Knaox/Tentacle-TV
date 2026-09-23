# Piloter l'Apple TV physique depuis le Mac

Un agent XCUITest qui appuie sur les touches de la télécommande de l'Apple TV
(`XCUIRemote`), prend des captures d'écran (`XCUIScreen`) et lit l'élément
focalisé, sur ordre du Mac. De quoi rejouer un parcours au D-pad et le
vérifier image par image, sans personne devant la télévision.

Le panneau simulateur de Claude ne rend rien pour tvOS, les flèches du
clavier n'atteignent pas le simulateur, et `devicectl` n'a ni capture ni
télécommande : c'est la seule voie qui marche sur l'appareil réel.

## Les pièces

| Fichier | Rôle |
|---|---|
| `Agent.xcodeproj`, `AgentUITests.swift` | L'agent : une boucle de test qui lit des commandes en TCP et répond. Une cible hôte minimale (`AgentHostApp.swift`) — l'agent pilote l'application par son identifiant, jamais cet hôte. |
| `server.mjs` | Côté Mac : TCP `8765` pour l'agent, HTTP `127.0.0.1:8766` pour envoyer des commandes. Les captures arrivent dans `out/`. |
| `cdpd.mjs`, `cdp.mjs`, `ids.js` | Le runtime JS de l'application par l'inspecteur de Metro : console enregistrée dans `console.log`, évaluation d'expressions (`node cdp.mjs '<expr>'`). |

## Lancer

```bash
# 1. Le serveur côté Mac
node server.mjs

# 2. L'agent, sur l'Apple TV (UDID de `xcodebuild -showdestinations`, équipe de signature)
TEST_RUNNER_AGENT_HOST=$(ipconfig getifaddr en0) xcodebuild \
  -project Agent.xcodeproj -scheme AgentUITests \
  -destination 'platform=tvOS,id=<UDID>' -derivedDataPath dd \
  DEVELOPMENT_TEAM=<équipe> CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates test
```

`TEST_RUNNER_*` : xcodebuild transmet ces variables au processus de test en
retirant le préfixe (`AGENT_HOST`, `AGENT_PORT`, `AGENT_BUNDLE`).

**Sur le simulateur tvOS**, le même agent, sans signature : destination
`'platform=tvOS Simulator,id=<UDID>'` et `TEST_RUNNER_AGENT_HOST=127.0.0.1`.
Le lanceur de tests passe devant l'application en démarrant : commencer par
`activate`, sinon `focus` échoue (`kAXErrorServerNotFound`) et met fin au
test. C'est ce que sert le banc de focus (`../focus-bench`), sans compte.

## Commander

```bash
curl -s -X POST localhost:8766/run -d '["down","wait:0.5","select","wait:1","shot:1280","focus"]'
```

`up` `down` `left` `right` `select` `menu` `play` `home`, `hold:1.2` (appui
long sur OK), `holddown:8` (flèche maintenue), `wait:0.5`, `shot` /
`shot:640` (largeur de la capture), `focus` (l'élément focalisé et son cadre),
`tree` (l'arbre d'accessibilité), `activate` (ramène l'application au premier
plan), `quit`.

## Pièges déjà payés

- XCTest attend que l'application soit « au repos » après chaque appui ; une
  application React Native ne l'est jamais. L'agent neutralise cette attente
  (`waitForQuiescence…`), sinon chaque appui coûte des dizaines de secondes.
- Liaison en TCP brut (Network.framework) : App Transport Security ne s'y
  applique pas, contrairement à `URLSession` vers une IP en HTTP.
- Après une installation par `devicectl`, l'application peut rester en
  arrière-plan : `activate` la ramène.
- Le rechargement à chaud de Metro laisse parfois des hooks désaccordés
  (« Rendered more hooks ») : relancer l'application à froid
  (`devicectl device process launch --terminate-existing`).
