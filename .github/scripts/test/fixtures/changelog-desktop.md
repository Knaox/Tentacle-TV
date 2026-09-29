# Extrait de changelogs/desktop.md (2026-09-29).

## [1.24.0]
### FR
- **Une fiche média refaite** : le décor occupe tout l'écran, avec le logo du titre, la note en grand et vos marqueurs ; « Lecture » ou « Reprendre » indique le temps restant, les actions sont réunies en une capsule, et les images du titre s'ouvrent en plein écran
- **Un clic sur un acteur ou un membre de l'équipe** ouvre sa page : portrait, biographie et ses titres présents sur le serveur
- **Des affiches qui en disent plus** : la note du public et la vôtre, Ma liste, favori et déjà vu se lisent sans survoler ; au survol, la lecture au centre, les étoiles et les actions rapides
- **Affiner vos recommandations** : dans Recommandations, une pile de titres à juger (j'aime, coup de cœur, pas pour moi), au glisser ou au clavier. Chaque verdict pèse vraiment dans ce qui vous est proposé
- **Bibliothèque, Ma liste et Mes favoris refaits** avec un même panneau d'outils ; Ma liste range vos titres par étape (à découvrir, en cours, terminés), propose « Reprendre », la vue grille ou liste et un retrait annulable ; Mes favoris se regroupent par type, genre ou décennie. Le bouton Partager se voit enfin
- **Un seul retour** pour sortir d'une suite de titres similaires ouverts les uns après les autres
- **Connexion, inscription et mot de passe oublié refaits**, plus lisibles et accessibles, avec le choix de la langue
- **L'écran des téléchargements refait** : un bilan de la file et de l'espace utilisé, la bascule du mode hors ligne, des sections par série et « Réessayer » sur un échec
- **Les listes et fiches partagées refaites** : on voit ce qui est partagé et comment rejoindre le serveur

### EN
- **A redesigned title page**: the backdrop fills the screen, with the title's logo, the rating in large and your markers; "Play" or "Resume" shows the time left, actions are gathered in one capsule, and the title's images open full screen
- **Clicking an actor or a crew member** opens their page: portrait, biography and their titles on the server
- **Posters that say more**: the audience rating and yours, My list, favorite and watched read at a glance; on hover, play in the center, stars and quick actions
- **Refine your recommendations**: in Recommendations, a stack of titles to judge (like, love, not for me), by dragging or with the keyboard. Every verdict truly weighs on what you are offered
- **Library, My list and My favorites redesigned** with one shared toolbar; My list sorts your titles by stage (to discover, in progress, finished), offers "Resume", a grid or list view and an undoable removal; My favorites group by type, genre or decade. The Share button is finally visible
- **One back** to leave a chain of similar titles opened one after another
- **Sign in, sign up and forgotten password redesigned**, clearer and more accessible, with a language choice
- **The downloads screen redesigned**: a summary of the queue and the space used, the offline mode switch, sections per series and "Retry" on a failure
- **Shared lists and title pages redesigned**: you see what is shared and how to join the server

## [1.23.0]
### FR
- **Administration : une vue d'ensemble** — l'administration s'ouvre sur l'état de Jellyfin et de la base de données, les sessions en direct, les tickets ouverts, les mises à jour de plugins, les comptes et les invitations actives ; chaque tuile mène à sa section
- **Administration : un menu rangé en trois groupes** (Activité, Comptes, Serveur) qui reste à l'écran, et des pages qui prennent toute la largeur de la fenêtre
- **Des contours, survols et anneaux de focus s'affichent enfin** : épisode ou saison sélectionnés, tickets, champs de connexion et de mot de passe, boutons de l'administration
- **Administrateurs : les invitations refaites** — des préréglages (1, 5 ou 10 personnes, 1 à 30 jours), le lien prêt à copier dès la création, et chaque invitation avec son statut, son échéance et les comptes qu'elle a ouverts. Le lien copié mène enfin au serveur : il pointait vers l'application elle-même et ne s'ouvrait nulle part
- **Administrateurs : la page Services refaite** — l'état de chaque service d'un regard, une section par service, les modifications non enregistrées visibles et annulables ; Jellyfin se teste sans ressortir la clé d'administration (serveur 1.19.3), et la réinitialisation du serveur demande de taper « réinitialiser »
- **Le bandeau « Clé Jellyfin hors service » s'affiche de nouveau** : il ne se montrait plus depuis la 1.20.9
- **Administrateurs : la page Utilisateurs refaite** — la photo de chaque compte, un résumé (comptes, actifs sur 7 jours, appareils jumelés), la recherche, un filtre et un tri ; un compte s'ouvre en fiche avec son activité, ses droits de téléchargement, ses appareils jumelés à révoquer et « Voir en tant que »
- **Administrateurs : la page Métadonnées refaite** — l'état de la clé TMDB d'un regard, testée sans être enregistrée, remplacée, retirée après confirmation ; un refus dit s'il vient de TMDB ou du réseau du serveur ; le calcul des recommandations se suit en direct ; la région se choisit parmi les pays couverts par TMDB, avec drapeaux, recherche et aperçu de leurs plateformes (serveur 1.19.3)
- **Administrateurs : la page Plugins refaite** — des cartes qui disent où en est chaque plugin (actif, mise à jour disponible, module serveur), un geste par carte avec son propre état ; un marketplace avec recherche, catégories et fiche détaillée (notes de version, dépôt) ; des sources qui disent ce que leur registre a donné. Le redémarrage du serveur qu'impose un module serveur est annoncé, puis suivi jusqu'au retour du serveur (serveur 1.19.3)

### EN
- **Administration: an overview** — administration opens on Jellyfin and database health, live sessions, open tickets, plugin updates, accounts and active invitations; every tile leads to its section
- **Administration: a menu sorted into three groups** (Activity, Accounts, Server) that stays on screen, and pages that use the full width of the window
- **Outlines, hover states and focus rings finally show up**: selected episode or season, tickets, sign-in and password fields, administration buttons
- **Administrators: invitations redesigned** — presets (1, 5 or 10 people, 1 to 30 days), the link ready to copy as soon as it is created, and each invitation with its status, expiry and the accounts it opened. The copied link now leads to the server: it pointed to the app itself and opened nowhere
- **Administrators: the Services page redesigned** — every service's state at a glance, one section per service, unsaved changes visible and cancellable; Jellyfin can be tested without digging out the admin key again (server 1.19.3), and resetting the server asks you to type "reset"
- **The "Jellyfin key out of service" banner shows again**: it had stopped appearing since 1.20.9
- **Administrators: the Users page redesigned** — each account's photo, a summary (accounts, active in the last 7 days, paired devices), search, a filter and sorting; an account opens into a sheet with its activity, download rights, paired devices to revoke and "View as"
- **Administrators: the Metadata page redesigned** — the TMDB key's state at a glance, tested without saving, replaced, removed after confirmation; a rejection says whether it comes from TMDB or from the server's network; the recommendation run can be followed live; the region is picked among the countries TMDB covers, with flags, search and a preview of their platforms (server 1.19.3)
- **Administrators: the Plugins page redesigned** — cards telling where each plugin stands (enabled, update available, server module), one action per card with its own state; a marketplace with search, categories and a detail sheet (release notes, repository); sources telling what their registry returned. The server restart a server module requires is announced, then followed until the server is back (server 1.19.3)

