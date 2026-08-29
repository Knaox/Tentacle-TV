/**
 * Ce garde separe 19 comptes reels les uns des autres. Un faux negatif rouvre
 * la lecture et la modification des donnees d'autrui ; un faux positif casse
 * l'application pour tout le monde. Les deux se testent ici, parce qu'aucun
 * des deux ne se verrait a l'ecran avant longtemps.
 */

import { describe, expect, it } from "vitest";
import { isOutOfScope, userIdFromPath } from "./userScope";

const ME = "f12b22ea52da40ef8b8bbafcfa1df3dc";
const OTHER = "f9cd69c53abe4af08c47d8b911011f02";

describe("identifiant porte par le chemin", () => {
  it("le trouve sur les routes qui en portent un", () => {
    expect(userIdFromPath(`Users/${ME}/Items`)).toBe(ME);
    expect(userIdFromPath(`Users/${ME}/Views`)).toBe(ME);
    expect(userIdFromPath(`Users/${ME}/FavoriteItems/abc`)).toBe(ME);
    expect(userIdFromPath(`Users/${ME}/PlayedItems/abc`)).toBe(ME);
    expect(userIdFromPath(`Users/${ME}/Images/Primary`)).toBe(ME);
  });

  it("ne voit pas d'identifiant la ou il n'y en a pas", () => {
    // `Me` est resolu par Jellyfin d'apres le jeton.
    expect(userIdFromPath("Users/Me")).toBeNull();
    expect(userIdFromPath("Users/me/Items")).toBeNull();
    // Pas de segment suivant : ce n'est pas une route utilisateur.
    expect(userIdFromPath("Users/AuthenticateByName")).toBeNull();
    // La route moderne : c'est le jeton qui decide, comme il se doit.
    expect(userIdFromPath("UserItems/abc/UserData")).toBeNull();
    // Rien a voir.
    expect(userIdFromPath("Items/abc/PlaybackInfo")).toBeNull();
    expect(userIdFromPath("Shows/NextUp")).toBeNull();
    expect(userIdFromPath("Videos/abc/stream")).toBeNull();
  });
});

describe("acces refuses", () => {
  it("refuse la lecture des donnees d'un autre compte", () => {
    // Constate sur le serveur reel : avec la cle admin substituee, cet appel
    // rendait 200 et 330 titres appartenant a quelqu'un d'autre.
    expect(isOutOfScope(`Users/${OTHER}/Items`, ME)).toBe(true);
    expect(isOutOfScope(`Users/${OTHER}/Views`, ME)).toBe(true);
  });

  it("refuse la MODIFICATION des donnees d'un autre compte", () => {
    expect(isOutOfScope(`Users/${OTHER}/FavoriteItems/item1`, ME)).toBe(true);
    expect(isOutOfScope(`Users/${OTHER}/PlayedItems/item1`, ME)).toBe(true);
    expect(isOutOfScope(`Users/${OTHER}/Images/Primary`, ME)).toBe(true);
  });
});

describe("acces legitimes", () => {
  it("laisse passer ses propres donnees", () => {
    for (const path of [
      `Users/${ME}/Items`,
      `Users/${ME}/Views`,
      `Users/${ME}/FavoriteItems/item1`,
      `Users/${ME}/PlayedItems/item1`,
      `Users/${ME}/Images/Primary`,
    ]) {
      expect(isOutOfScope(path, ME), path).toBe(false);
    }
  });

  it("laisse passer tout ce qui ne nomme pas d'utilisateur", () => {
    for (const path of [
      "Users/Me",
      "Users/AuthenticateByName",
      "UserItems/abc/UserData",
      "Items/abc/PlaybackInfo",
      "Shows/NextUp",
      "Videos/abc/ms1/master.m3u8",
      "System/Info/Public",
    ]) {
      expect(isOutOfScope(path, ME), path).toBe(false);
    }
  });

  it("tolere les deux formes d'identifiant de Jellyfin", () => {
    // Jellyfin rend tantot « f12b22ea-52da-40ef-8b8b-bafcfa1df3dc », tantot la
    // forme compacte, et la casse varie selon l'appelant. Une comparaison
    // stricte refuserait des requetes parfaitement legitimes -- et un garde qui
    // bloque le cas normal finit toujours par etre retire.
    const withDashes = "f12b22ea-52da-40ef-8b8b-bafcfa1df3dc";
    expect(isOutOfScope(`Users/${withDashes}/Items`, ME)).toBe(false);
    expect(isOutOfScope(`Users/${ME}/Items`, withDashes)).toBe(false);
    expect(isOutOfScope(`Users/${ME.toUpperCase()}/Items`, ME)).toBe(false);
  });

  it("la tolerance ne va pas jusqu'a confondre deux comptes", () => {
    expect(isOutOfScope(`Users/${OTHER.toUpperCase()}/Items`, ME)).toBe(true);
  });
});

describe("la casse du chemin ne contourne pas le garde", () => {
  it("suit isAllowedProxyPath, qui est insensible a la casse", () => {
    // Si le garde etait plus strict que la liste blanche qu'il double, il
    // suffirait d'ecrire « users/… » pour passer a cote.
    expect(isOutOfScope(`users/${OTHER}/Items`, ME)).toBe(true);
    expect(isOutOfScope(`USERS/${OTHER}/items`, ME)).toBe(true);
  });
});
