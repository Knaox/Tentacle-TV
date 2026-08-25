import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { isPackaged: true } }));

import { nativeHandle } from "./native";

/** Une fenêtre réduite à ce que `nativeHandle` lui demande. */
const fenetre = (tampon: Buffer) =>
  ({ getNativeWindowHandle: () => tampon }) as unknown as Parameters<typeof nativeHandle>[0];

describe("nativeHandle", () => {
  it("lit les huit octets d'un HWND ou d'un NSView*", () => {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(0x7fff_1234_5678n);
    expect(nativeHandle(fenetre(b))).toBe(0x7fff_1234_5678n);
  });

  it("lit les QUATRE octets d'un numéro de fenêtre X11", () => {
    // Le défaut qui coûtait toute la vidéo sous Linux : `readBigUInt64LE` levait
    // ERR_BUFFER_OUT_OF_BOUNDS, et `mpv_init` échouait avant la première image.
    const b = Buffer.alloc(4);
    b.writeUInt32LE(0x0060_0004);
    expect(nativeHandle(fenetre(b))).toBe(0x600004n);
  });

  it("rend zéro plutôt que de lever sur un tampon vide", () => {
    // Wayland peut ne rien donner du tout ; ce n'est pas une raison d'empêcher
    // une lecture, mpv n'y recevant jamais de `wid`.
    expect(nativeHandle(fenetre(Buffer.alloc(0)))).toBe(0n);
  });
});
