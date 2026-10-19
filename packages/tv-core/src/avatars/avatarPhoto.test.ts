import { describe, expect, it } from "vitest";
import { accountPhotoPath, avatarImageUrl, avatarPhotoFromDataUrl } from "./avatarPhoto";

describe("les images de la troupe, servies par le serveur", () => {
  it("la vignette et l'image entière, quelle que soit la barre finale de l'adresse", () => {
    expect(avatarImageUrl("https://tv.example/", "huit", "thumb")).toBe("https://tv.example/avatars/thumbs/huit.webp");
    expect(avatarImageUrl("https://tv.example", "huit", "full")).toBe("https://tv.example/avatars/huit.webp");
  });

  it("rien sans serveur, ni pour un identifiant qui sortirait du dossier", () => {
    expect(avatarImageUrl(null, "huit", "full")).toBeNull();
    expect(avatarImageUrl("https://tv.example", "../secret", "full")).toBeNull();
    expect(avatarImageUrl("https://tv.example", "Huit", "full")).toBeNull();
  });
});

describe("l'image lue, prête à partir", () => {
  it("le corps base64 et son type", () => {
    expect(avatarPhotoFromDataUrl("data:image/webp;base64,UklGRg==")).toEqual({ base64: "UklGRg==", mime: "image/webp" });
    expect(avatarPhotoFromDataUrl("data:Image/WebP;charset=binary;base64,UklG\nRg==")).toEqual({ base64: "UklGRg==", mime: "image/webp" });
  });

  it("refuse ce qui n'est pas une image non vide : la page du client web, un corps vide", () => {
    expect(avatarPhotoFromDataUrl("data:text/html;base64,PGh0bWw+")).toBeNull();
    expect(avatarPhotoFromDataUrl("data:image/webp;base64,")).toBeNull();
    expect(avatarPhotoFromDataUrl("data:application/octet-stream;base64,AAAA")).toBeNull();
    expect(avatarPhotoFromDataUrl("pas une image")).toBeNull();
  });

  it("prend le type déclaré par la réponse : le blob d'Android n'en a pas", () => {
    // Android : `FileReader` dit `application/octet-stream`, l'en-tête dit l'image.
    expect(avatarPhotoFromDataUrl("data:application/octet-stream;base64,UklGRg==", "image/webp")).toEqual({ base64: "UklGRg==", mime: "image/webp" });
    expect(avatarPhotoFromDataUrl("data:application/octet-stream;base64,UklGRg==", "Image/WebP; charset=binary")).toEqual({ base64: "UklGRg==", mime: "image/webp" });
    // Sans en-tête (ou vide), le type du `data:`, comme sur iOS.
    expect(avatarPhotoFromDataUrl("data:image/webp;base64,UklGRg==", null)).toEqual({ base64: "UklGRg==", mime: "image/webp" });
    expect(avatarPhotoFromDataUrl("data:image/webp;base64,UklGRg==", " ")).toEqual({ base64: "UklGRg==", mime: "image/webp" });
  });

  it("l'en-tête fait foi : la page du client web reste refusée, même lue comme octets", () => {
    expect(avatarPhotoFromDataUrl("data:application/octet-stream;base64,PGh0bWw+", "text/html; charset=utf-8")).toBeNull();
    expect(avatarPhotoFromDataUrl("data:image/webp;base64,PGh0bWw+", "text/html")).toBeNull();
  });
});

describe("la photo du compte, par le proxy", () => {
  it("se pose sur la route que le proxy permet à un appareil", () => {
    expect(accountPhotoPath("https://tv.example/api/jellyfin/", "abc")).toBe("https://tv.example/api/jellyfin/Users/abc/Images/Primary");
  });
});
