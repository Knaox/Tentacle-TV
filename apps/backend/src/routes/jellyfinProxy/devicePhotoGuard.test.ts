/**
 * Le compte de démonstration (revue Apple) ne change pas sa photo par la TV :
 * le proxy refuse cette écriture-là, et seulement elle.
 */

import { describe, expect, it } from "vitest";
import { devicePhotoRefusal, isAccountPhotoWrite } from "./devicePhotoGuard";

const USER = "0123456789abcdef0123456789abcdef";
const PHOTO = `Users/${USER}/Images/Primary`;
const yes = async () => true;
const no = async () => false;

describe("la photo du compte de démonstration", () => {
  it("est refusée quand le serveur ne la permet pas", async () => {
    expect(await devicePhotoRefusal("POST", PHOTO, no)).toMatch(/demonstration/);
  });

  it("passe pour tout autre compte", async () => {
    expect(await devicePhotoRefusal("POST", PHOTO, yes)).toBeNull();
  });

  it("ne regarde que l'écriture de la photo : le compte de démonstration lit et note comme avant", async () => {
    let asked = 0;
    const counted = async () => { asked += 1; return false; };
    expect(await devicePhotoRefusal("GET", PHOTO, counted)).toBeNull();
    expect(await devicePhotoRefusal("HEAD", PHOTO, counted)).toBeNull();
    expect(await devicePhotoRefusal("POST", `Users/${USER}/FavoriteItems/abc`, counted)).toBeNull();
    expect(await devicePhotoRefusal("POST", "Sessions/Playing", counted)).toBeNull();
    expect(asked).toBe(0);
  });

  it("reconnaît l'écriture de la photo en toute casse, jamais Users/Me", () => {
    expect(isAccountPhotoWrite("post", `users/${USER}/images/primary`)).toBe(true);
    expect(isAccountPhotoWrite("POST", "Users/Me/Images/Primary")).toBe(false);
    expect(isAccountPhotoWrite("DELETE", PHOTO)).toBe(false);
  });
});
