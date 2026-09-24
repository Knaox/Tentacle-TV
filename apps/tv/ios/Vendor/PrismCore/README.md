# PrismCore 3.2.2 — copie modifiée pour Tentacle TV

Copie de [PrismCore](https://github.com/Wenzlik/PrismCore) **3.2.2**
(commit `9fa49af`), déclarée dans `TentacleTV.xcworkspace` comme paquet
local : elle **remplace** le paquet distant de même identité que le projet
Xcode référence toujours (`XCRemoteSwiftPackageReference "PrismCore"`).

## Pourquoi une copie

Une seule modification, dans `Sources/PrismCore/Remux/AudioBridge.swift`
(`negotiateLayout`, balisée « Modified for Tentacle TV ») :

Le pont audio de PrismCore réencode ce qu'AVPlayer ne lit pas (DTS, DTS-HD MA,
TrueHD, PCM…). Faute d'encodeur `eac3` dans le FFmpeg de MPVKit, sa cible est
l'AAC — et il gardait la disposition de la source, le 5.1 « side » que rendent
les décodeurs DTS et TrueHD. Pour toute disposition hors de ses dispositions
« normales », l'encodeur AAC de FFmpeg écrit un `program_config_element`, que
les décodeurs d'Apple refusent net : `afinfo` échoue à ouvrir le fichier,
AVPlayer répond `-16170` sur le master et `-11829` sur la forme muxée. Tout
titre aux pistes DTS ou TrueHD échouait sur Apple TV (mesuré le 2026-09-24,
Apple TV 4K, tvOS 26.6) et finissait en transcodage serveur.

Le correctif ramène l'AAC sur la disposition standard de même largeur
(5.1 « back »), que le rééchantillonneur remappe.

## Ce qui est repris, ce qui ne l'est pas

`Package.swift` (réduit à la bibliothèque), `Sources/PrismCore`, `LICENSE`,
`NOTICE.md`. Les tests, le fuzzer et les scripts restent en amont.

## Licence

PrismCore est sous LGPL-2.1 ou ultérieure, avec une exception pour les
boutiques d'applications (voir `LICENSE`). L'exception couvre l'*usage* de la
bibliothèque ; une version modifiée reste soumise à la LGPL et ses
modifications doivent être publiées : c'est l'objet de ce dossier, dans un
dépôt public.

## Retirer la copie

Quand l'amont corrige la négociation de disposition : supprimer ce dossier et
la ligne `group:Vendor/PrismCore` de `TentacleTV.xcworkspace/contents.xcworkspacedata`.
Le projet retombe alors sur le paquet distant (règle « jusqu'à la prochaine
majeure » depuis 3.2.0).

Pour une montée de version en attendant : recopier `Sources/PrismCore` de la
nouvelle version, réappliquer le bloc balisé, rebâtir, et rejouer un titre en
DTS seul sur l'Apple TV (banc `apps/tv/harness/atv-remote`).
