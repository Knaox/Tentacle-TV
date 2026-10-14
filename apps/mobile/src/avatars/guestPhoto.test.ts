import { describe, expect, it } from "vitest";
import { FAMILY_GUEST_PHOTO_MAX_BASE64 } from "@tentacle-tv/shared";
import { guestPhotoBody } from "./guestPhoto";

describe("la photo d'un invité, telle que le serveur la reçoit", () => {
  it("un personnage (WebP) ou une photo (JPEG, PNG) : le base64 nu et son type", () => {
    expect(guestPhotoBody({ base64: "UklGRg==", mime: "image/webp" })).toEqual({ image: "UklGRg==", type: "image/webp" });
    expect(guestPhotoBody({ base64: "/9j/", mime: "IMAGE/JPEG" })).toEqual({ image: "/9j/", type: "image/jpeg" });
    expect(guestPhotoBody({ base64: "iVBO", mime: "image/png" })).toEqual({ image: "iVBO", type: "image/png" });
  });

  it("un format que le serveur ne relaie pas, ou une image trop lourde, ne part pas", () => {
    expect(guestPhotoBody({ base64: "AAAA", mime: "image/heic" })).toBeNull();
    expect(guestPhotoBody({ base64: "A".repeat(FAMILY_GUEST_PHOTO_MAX_BASE64 + 1), mime: "image/jpeg" })).toBe("tooLarge");
  });
});
