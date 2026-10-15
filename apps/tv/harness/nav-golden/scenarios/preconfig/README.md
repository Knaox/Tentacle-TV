# Scénarios — la préconfiguration de la barre (15/10)

La page « Quelles bibliothèques dans votre barre ? » (route `RailSetup`,
Apple TV et Android TV), une fois par profil et par appareil, AVANT
l'accueil — et l'étape du propriétaire, « Appliquer aussi à d'autres
profils ? ». Règles : tv-core `nav/railSetupScreen.ts`,
`nav/railSetupApply.ts` (l'écran), `nav/railSetup.ts` (la porte du socle).

Le banc pose la préconfiguration FAITE pour ses comptes
(`BENCH_RAIL_PROFILES`, `lib/config.mjs`) : ces scénarios la vident
(`storage.tentacle_tv_rail_profiles: "{}"`) pour que la page soit due.

- `preconfig-jumelage` : jumelage par identifiants → la page → « Continuer »
  → l'accueil ; la disposition enregistrée est relevée (`storage`).
- `preconfig-demarrage` : une installation qui ne l'a jamais faite démarre
  SUR la page (jamais l'accueil d'abord) ; Retour vaut « Passer ».
- `preconfig-profil-proprietaire` : « Qui regarde ? » → le propriétaire →
  la page → « Continuer » → l'étape du propriétaire → « Appliquer » à
  l'invitée → l'accueil.

Enregistrés sur le code du lot (pas d'avant : la page n'existait pas) ;
`verify --android` les rejoue sur l'émulateur contre ces références.
