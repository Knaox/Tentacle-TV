# Le web, miroir de l'app mobile

Sous le seuil du bureau, le client web (`apps/web`) reproduit **à l'identique**
l'app des stores (`apps/mobile`) : sur un téléphone, l'app iPhone/Android ; sur
un iPad, l'app iPad. Le bureau — fenêtre large d'un navigateur ET application
Electron, qui embarque ce même build — ne change pas.

Tout le miroir vit dans `apps/web/src/mirror/`. Les pages du bureau ne sont pas
retouchées : le routeur choisit l'une ou l'autre version (`ByFormFactor`).

## Les seuils

| Situation | Gabarit | Navigation |
|-----------|---------|------------|
| Application Electron, quelle que soit la fenêtre | **bureau** (hérité, inchangé) | barre du haut ; en fenêtre étroite, l'ancienne barre d'onglets |
| Navigateur à la souris, largeur > 768 px | **bureau** | barre du haut |
| Navigateur à la souris, largeur ≤ 768 px | téléphone | barre d'onglets flottante |
| Écran tactile, petit côté < 700 px | téléphone | barre d'onglets flottante |
| Écran tactile, petit côté ≥ 700 px, portrait | tablette | barre d'onglets flottante |
| Écran tactile, petit côté ≥ 700 px, paysage | tablette | rail latéral de 76 px + tiroir |

- **Tactile** = `(pointer: coarse) and (hover: none)`, sur le pointeur
  PRINCIPAL. L'iPad se reconnaît ainsi, pas à son agent utilisateur : iPadOS se
  présente comme un Mac. Un portable tactile Windows annonce `hover: hover`
  (souris ou pavé) et reste donc un bureau.
- **700 px sur le petit côté** : le seuil de l'app (`TABLET_MIN_WIDTH`,
  `apps/mobile/src/theme/responsive.ts`). Mesuré sur le petit côté, il ne
  change pas en tournant l'appareil. iPad mini = 744, iPad = 820, iPad Pro = 1024.
- **768 px à la souris** : la bascule d'avant (`useIsMobile`). Une fenêtre de
  bureau rétrécie montrait déjà la barre d'onglets ; elle montre désormais celle
  de l'app. Une fenêtre à la souris ne devient jamais « tablette ».

Code : `mirror/formFactor.ts` (décision pure, testée), `mirror/useFormFactor.ts`
(abonnement au viewport).

### Forcer un gabarit (développement)

Le volet de préversion n'émule pas le tactile d'un iPad. En `vite dev` seulement :
`?formFactor=tablet` (ou `phone`, `desktop`) force le gabarit et le garde en
`localStorage` (`tentacle_dev_form_factor`) ; `?formFactor=auto` l'efface.

## Les mesures, recopiées de l'app

`mirror/responsive.ts` recopie les règles de `apps/mobile/src/theme/responsive.ts`,
`heroMetrics.ts` et `CardDensityContext.tsx` :

- grilles : 3 colonnes au téléphone ; sur tablette (largeur ≥ 700), colonnes
  dérivées d'une carte cible de 150 px, plafond 8, rail soustrait ;
- colonne de lecture centrée : 640 (réglages, à propos), 720 (sous-pages de
  réglages), 920 (fiche) ;
- cartes de rangée : 130 px au téléphone, 168 sur tablette, × densité du compte
  (0,85 / 1 / 1,2) ;
- bannière d'accueil : hauteur `min(660 | 820, 0,74 × écran)`, marges 16, rayon 20,
  affiche au lieu du visuel large quand la carte est plus haute que large.

Une mesure changée dans l'app se change ici aussi : c'est tout l'objet du miroir.
