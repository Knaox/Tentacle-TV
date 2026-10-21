import { acceptRecoTrendingHead } from "@tentacle-tv/api-client";

/**
 * Le mobile (téléphone, iPad) rend « Tendances actuelles » en tête de « Pour
 * vous » (`?trendingNow=1`, capacité `reco.trending`) : une rangée comme les
 * autres, par `RecoRow`. Posé au chargement du module racine, avant toute
 * requête : toutes les pages en cache sont demandées ainsi. Face à un serveur
 * qui ne déclare pas la capacité, la requête reste celle d'avant.
 */
acceptRecoTrendingHead();
