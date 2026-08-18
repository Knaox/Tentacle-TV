# @tentacle-tv/tv-core

Le comportement du salon, écrit une fois.

Ce paquet ne contient **aucun rendu** : ni DOM, ni React Native, ni CSS. Rien que
des machines à états, des tables de correspondance et de la géométrie — des
fonctions pures, avec leurs tests.

## Pourquoi

Les trois cibles téléviseur — LG webOS, Apple TV, Android TV — se comportaient
déjà de la même façon, mais parce que quelqu'un avait recopié les mêmes chiffres
à la main dans deux dépôts de code. Le délai d'annulation du défilement (7 s), le
tic de maintien (250 ms), les paliers d'accélération (×1, ×2, ×4, ×8), le délai
de masquage des commandes (5 s) : identiques des deux côtés, et rien n'empêchait
l'un de dériver sans que l'autre le sache.

Ce paquet supprime le doublon. Les tests qui vivaient dans la cible webOS l'ont
suivi : ils sont désormais le filet de non-régression des trois plateformes.

## Ce qui n'entre pas ici

- **Le rendu.** Une carte, un panneau, une barre de progression se dessinent
  différemment en DOM et en React Native ; seule leur *spécification* peut être
  partagée, et elle vit dans `@tentacle-tv/theme`.
- **La résolution du signal d'entrée.** Reconstituer « appui court » ou
  « maintien » depuis un flux `keydown`/`keyup` DOM peu fiable, lire les
  événements sémantiques d'Android, ou dériver une vitesse du trackpad de la
  Siri Remote : trois problèmes différents, trois adaptateurs par plateforme.
  Ce qu'ils produisent — l'intention — est en revanche commun, et c'est ce que
  consomment les machines d'ici.
- **Le décodage.** Profils de codec, remux, HDR : irréductiblement natif.
- **La navigation au focus.** Apple TV et Android TV la résolvent nativement ;
  seule la LG doit la calculer, faute de navigation spatiale dans un navigateur.
  Seule la géométrie (`focus/geometry.ts`) est ici, parce qu'elle sert aussi à
  décider d'un défilement — le reste du moteur reste dans la cible webOS.
