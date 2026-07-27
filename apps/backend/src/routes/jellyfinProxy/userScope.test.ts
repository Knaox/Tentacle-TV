/**
 * Ce garde separe 19 comptes reels les uns des autres. Un faux negatif rouvre
 * la lecture et la modification des donnees d'autrui ; un faux positif casse
 * l'application pour tout le monde. Les deux se testent ici, parce qu'aucun
 * des deux ne se verrait a l'ecran avant longtemps.
 */

import { describe, expect, it } from "vitest";
import { horsDuPerimetre, userIdDuChemin } from "./userScope";

const MOI = "f12b22ea52da40ef8b8bbafcfa1df3dc";
const AUTRE = "f9cd69c53abe4af08c47d8b911011f02";

describe("identifiant porte par le chemin", () => {
  it("le trouve sur les routes qui en portent un", () => {
    expect(userIdDuChemin(`Users/${MOI}/Items`)).toBe(MOI);
    expect(userIdDuChemin(`Users/${MOI}/Views`)).toBe(MOI);
    expect(userIdDuChemin(`Users/${MOI}/FavoriteItems/abc`)).toBe(MOI);
    expect(userIdDuChemin(`Users/${MOI}/PlayedItems/abc`)).toBe(MOI);
    expect(userIdDuChemin(`Users/${MOI}/Images/Primary`)).toBe(MOI);
  });

  it("ne voit pas d'identifiant la ou il n'y en a pas", () => {
    // `Me` est resolu par Jellyfin d'apres le jeton.
    expect(userIdDuChemin("Users/Me")).toBeNull();
    expect(userIdDuChemin("Users/me/Items")).toBeNull();
    // Pas de segment suivant : ce n'est pas une route utilisateur.
    expect(userIdDuChemin("Users/AuthenticateByName")).toBeNull();
    // La route moderne : c'est le jeton qui decide, comme il se doit.
    expect(userIdDuChemin("UserItems/abc/UserData")).toBeNull();
    // Rien a voir.
    expect(userIdDuChemin("Items/abc/PlaybackInfo")).toBeNull();
    expect(userIdDuChemin("Shows/NextUp")).toBeNull();
    expect(userIdDuChemin("Videos/abc/stream")).toBeNull();
  });
});

describe("acces refuses", () => {
  it("refuse la lecture des donnees d'un autre compte", () => {
    // Constate sur le serveur reel : avec la cle admin substituee, cet appel
    // rendait 200 et 330 titres appartenant a quelqu'un d'autre.
    expect(horsDuPerimetre(`Users/${AUTRE}/Items`, MOI)).toBe(true);
    expect(horsDuPerimetre(`Users/${AUTRE}/Views`, MOI)).toBe(true);
  });

  it("refuse la MODIFICATION des donnees d'un autre compte", () => {
    expect(horsDuPerimetre(`Users/${AUTRE}/FavoriteItems/item1`, MOI)).toBe(true);
    expect(horsDuPerimetre(`Users/${AUTRE}/PlayedItems/item1`, MOI)).toBe(true);
    expect(horsDuPerimetre(`Users/${AUTRE}/Images/Primary`, MOI)).toBe(true);
  });
});

describe("acces legitimes", () => {
  it("laisse passer ses propres donnees", () => {
    for (const chemin of [
      `Users/${MOI}/Items`,
      `Users/${MOI}/Views`,
      `Users/${MOI}/FavoriteItems/item1`,
      `Users/${MOI}/PlayedItems/item1`,
      `Users/${MOI}/Images/Primary`,
    ]) {
      expect(horsDuPerimetre(chemin, MOI), chemin).toBe(false);
    }
  });

  it("laisse passer tout ce qui ne nomme pas d'utilisateur", () => {
    for (const chemin of [
      "Users/Me",
      "Users/AuthenticateByName",
      "UserItems/abc/UserData",
      "Items/abc/PlaybackInfo",
      "Shows/NextUp",
      "Videos/abc/ms1/master.m3u8",
      "System/Info/Public",
    ]) {
      expect(horsDuPerimetre(chemin, MOI), chemin).toBe(false);
    }
  });

  it("tolere les deux formes d'identifiant de Jellyfin", () => {
    // Jellyfin rend tantot « f12b22ea-52da-40ef-8b8b-bafcfa1df3dc », tantot la
    // forme compacte, et la casse varie selon l'appelant. Une comparaison
    // stricte refuserait des requetes parfaitement legitimes -- et un garde qui
    // bloque le cas normal finit toujours par etre retire.
    const avecTirets = "f12b22ea-52da-40ef-8b8b-bafcfa1df3dc";
    expect(horsDuPerimetre(`Users/${avecTirets}/Items`, MOI)).toBe(false);
    expect(horsDuPerimetre(`Users/${MOI}/Items`, avecTirets)).toBe(false);
    expect(horsDuPerimetre(`Users/${MOI.toUpperCase()}/Items`, MOI)).toBe(false);
  });

  it("la tolerance ne va pas jusqu'a confondre deux comptes", () => {
    expect(horsDuPerimetre(`Users/${AUTRE.toUpperCase()}/Items`, MOI)).toBe(true);
  });
});

describe("la casse du chemin ne contourne pas le garde", () => {
  it("suit isAllowedProxyPath, qui est insensible a la casse", () => {
    // Si le garde etait plus strict que la liste blanche qu'il double, il
    // suffirait d'ecrire « users/… » pour passer a cote.
    expect(horsDuPerimetre(`users/${AUTRE}/Items`, MOI)).toBe(true);
    expect(horsDuPerimetre(`USERS/${AUTRE}/items`, MOI)).toBe(true);
  });
});
