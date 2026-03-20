# Tentacle TV — Notes de mise à jour

## v1.1.0-beta — 20 mars 2026

---

### Nouveautés

#### Filtres avancés dans les bibliothèques
Explorez vos bibliothèques comme jamais avec un panneau de filtres complet, inspiré du plugin Seer :
- **Filtres rapides** : Tous / Non vus / En cours / Favoris — accessibles en un clic
- **Genres** : parcourez vos films et séries par genre (Action, Comédie, Drame...)
- **Plateformes** : filtrez par Netflix, Disney+, Amazon Prime Video, Crunchyroll, Apple TV+, Paramount+, Max, ADN, OCS, Canal+ et Arte
- **Année** : filtrez par plage d'années (de/à)
- **Note minimum** : ne voyez que les films les mieux notés
- **Tri avancé** : par date d'ajout, titre, année ou note — croissant ou décroissant
- **Pills actifs** : visualisez vos filtres appliqués et supprimez-les individuellement
- **Multi-sélection plateformes** : combinez Netflix + Disney+ pour voir tout votre contenu
- Disponible sur **web, desktop et mobile**

#### Plugin Seer v1.5.0-beta

**Onglet Anime**
- Nouvel onglet "Animes" dans la page Découvrir
- Affiche uniquement les vrais anime (via les données TMDB)

**Sélection de saisons**
- Lors d'une suppression ou d'une re-demande de série, vous pouvez maintenant choisir quelles saisons supprimer ou redemander
- Supprimer une saison spécifique ne touche pas aux autres saisons dans Sonarr

**File d'attente de nettoyage**
- Les suppressions de médias dans Sonarr/Radarr passent par une file d'attente avec retry automatique
- Si Sonarr ou Radarr ne répond pas, la suppression sera réessayée jusqu'à 20 fois avec un délai croissant
- Plus aucun média "fantôme" après une suppression

**Navigation directe vers les médias disponibles**
- Dans la page Découvrir, cliquer sur un film ou une série disponible vous redirige directement vers la page du média dans Tentacle — plus besoin d'ouvrir le détail
- Fonctionne sur web, desktop et mobile
- Les séries 100% disponibles redirigent aussi directement

**Demande de séries améliorée**
- Le bouton "Demander" en tête d'affiche pour les séries ouvre maintenant le sélecteur de saisons au lieu de demander toute la série d'un coup
- Vous choisissez exactement quelles saisons vous voulez

**Badges en temps réel**
- Après avoir demandé un média, le badge "Demandé" apparaît instantanément dans la grille Découvrir, les résultats de recherche et le carrousel — sans besoin de rafraîchir la page
- Fonctionne pour les films et les séries

---

### Corrections de bugs

#### Plugin Seer
- **Statuts corrigés** : les médias en échec dans Jellyseerr s'affichaient comme "En téléchargement" — corrigé (prise en charge du status 3 = declined ET status 4 = failed de Jellyseerr)
- **Auto-retry des échecs** : les demandes en échec sont automatiquement redemandées par le worker (jusqu'à 10 tentatives) — y compris les échecs de téléchargement détectés via downloadStatus
- **Suppression complète** : supprimer un média retire maintenant aussi les fichiers de Sonarr/Radarr (avec les données)
- **Bouton "Découvrir du contenu"** : fonctionne maintenant sur web et mobile (navigation cross-plateforme corrigée)
- **Ctrl+K masqué sur mobile** : le raccourci clavier n'apparaît plus sur les appareils tactiles
- **Sync accélérée** : les statuts sont synchronisés avec Jellyseerr toutes les 2 minutes (au lieu de 5)
- **Protection des données** : les tables du plugin sont déclarées dans le schema Prisma — les demandes ne sont plus perdues lors des mises à jour ou redémarrages

#### Interface web
- **Scroll infini** : correction du calcul de position dynamique dans les bibliothèques (recalcul quand les filtres changent la hauteur)

---

### Notes techniques
- Le filtre par plateforme utilise les données TMDB via votre instance Jellyseerr — aucune configuration supplémentaire nécessaire
- Si le plugin Seer n'est pas installé, le filtre plateforme fonctionne en mode dégradé (basé sur les studios des métadonnées)
- Les données de plateformes sont mises en cache côté serveur pour des performances optimales
- La résolution TMDB → Jellyfin pour la navigation passe par une route dédiée `/api/tmdb/resolve` qui utilise la clé admin Jellyfin (aucun problème de permissions utilisateur)
