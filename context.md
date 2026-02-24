\# Project Context: ARCANE (Premium Media Client)



\## Vision

Arcane est un client media multi-plateforme ultra-performant basé sur l'API Jellyfin. 

L'objectif est d'offrir une interface plus belle que Plex et une rapidité de lecture supérieure.



\## Tech Stack Rules

\- \*\*Framework\*\*: React 18+ / React Native

\- \*\*Styling\*\*: Tailwind CSS (Web/Desktop), NativeWind (Mobile)

\- \*\*Data Fetching\*\*: TanStack Query (Obligatoire pour le cache)

\- \*\*API\*\*: Communication avec Jellyfin API via `X-Emby-Token`

\- \*\*Animations\*\*: Framer Motion (Transitions fluides entre pages)



\## Coding Standards

1\. \*\*Performance First\*\*: 

&nbsp;  - Utilisation de `memo`, `useCallback` et `useMemo` pour éviter les re-renders inutiles.

&nbsp;  - Lazy loading des images avec squelettes de chargement (shimmer effect).

2\. \*\*Video Optimization\*\*: 

&nbsp;  - Prioriser le "Direct Play".

&nbsp;  - Buffer pré-chargé de 30 secondes.

&nbsp;  - Gestion intelligente des erreurs de codec (Fallback automatique vers transcodage).

3\. \*\*Clean Code\*\*: 

&nbsp;  - Composants fonctionnels uniquement.

&nbsp;  - Séparation stricte entre la logique (Hooks) et l'affichage (UI).

&nbsp;  - Typage Typescript strict.



\## API Endpoints Key

\- Base URL: `SERVER\_URL`

\- Auth: `/Users/AuthenticateByName`

\- Library: `/Items` (filtré par ParentId)

\- Stream: `/Videos/{Id}/stream` (HLS/Direct)

