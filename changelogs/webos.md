# Changelog — LG webOS

Blocs `## [X.Y.Z]` avec sous-sections `### FR` / `### EN`. Lu par
`.github/workflows/webos.yml` pour les notes de la Release GitHub (illimité).
Renommer `[Unreleased]` en `[X.Y.Z]` au moment d'envoyer (la version vient de
`versions.json` → `webos`).

**Le paquet ne contient que la coquille** : le client React est servi par le
serveur Tentacle sur `/tv`. La plupart des corrections partent donc avec une
mise à jour du SERVEUR, sans nouvel IPK — n'ajouter ici que ce qui touche
réellement la coquille (icône, titre, splash, identifiant, comportement de
lancement), ou une version de référence.

## [Unreleased]
### FR
- …
### EN
- …

## [1.0.0]
### FR
- Première version pour téléviseurs LG (webOS 4 et ultérieurs)
- Navigation entièrement à la télécommande, dessinée pour être lue à trois mètres
- Lecture directe privilégiée : le téléviseur lit vos fichiers tels quels, sans que le serveur ait à les convertir
- Dolby Vision pris en charge sur les conteneurs qui le transportent ; ailleurs, l'image reste en HDR
- Reprise de lecture, déplacement dans le film et changement de piste audio ou de sous-titres
- Installation depuis un Mac, un PC Windows ou une machine Linux : décompressez l'archive ci-dessous, double-cliquez, répondez à deux questions

### EN
- First release for LG TVs (webOS 4 and later)
- Full remote-control navigation, designed to be read from three metres away
- Direct play first: the TV reads your files as they are, with no server-side conversion
- Dolby Vision supported in the containers that carry it; elsewhere the picture stays HDR
- Resume, in-movie seeking, and audio or subtitle track switching
- Install from a Mac, a Windows PC or a Linux machine: unzip the archive below, double-click, answer two questions
