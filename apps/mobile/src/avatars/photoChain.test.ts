import { describe, expect, it, vi } from "vitest";
import {
  bytesToBase64,
  characterPhotoFrom,
  serverAvatarUrl,
  type CharacterPhotoSources,
  type ImageResponse,
} from "./photoChain";

const BYTES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x57, 0x45, 0x42, 0x50, 0xff]);

function response(over: Partial<{ ok: boolean; status: number; type: string | null; bytes: Uint8Array }> = {}): ImageResponse {
  const { ok = true, status = 200, type = "image/webp", bytes = BYTES } = over;
  return {
    ok,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? type : null) },
    arrayBuffer: async () => bytes.slice().buffer,
  };
}

function sources(bundled: CharacterPhotoSources["bundled"], answer: ImageResponse | Error): CharacterPhotoSources {
  return {
    bundled: vi.fn(bundled),
    fetcher: vi.fn(async () => {
      if (answer instanceof Error) throw answer;
      return answer;
    }),
  };
}

const embedded = { base64: "ZW1iYXJxdcOpZQ==", mime: "image/webp" };
const unreadable = async () => {
  throw new Error("ressource Android illisible");
};

describe("l'image d'un personnage : embarquée, puis le serveur, puis l'échec", () => {
  it("l'image embarquée suffit : le serveur n'est pas sollicité", async () => {
    const deps = sources(async () => embedded, response());
    await expect(characterPhotoFrom("huit", "https://tentacle.example", deps)).resolves.toEqual(embedded);
    expect(deps.fetcher).not.toHaveBeenCalled();
  });

  it("l'image embarquée illisible : celle du serveur, encodée comme Jellyfin l'attend", async () => {
    const deps = sources(unreadable, response());
    await expect(characterPhotoFrom("huit", "https://tentacle.example/", deps)).resolves.toEqual({
      base64: Buffer.from(BYTES).toString("base64"),
      mime: "image/webp",
    });
    expect(deps.fetcher).toHaveBeenCalledWith("https://tentacle.example/avatars/huit.webp");
  });

  it("un serveur d'avant sans le fichier — 404, ou la page du client web en 200 — : l'échec d'aujourd'hui", async () => {
    await expect(characterPhotoFrom("huit", "https://tentacle.example", sources(unreadable, response({ ok: false, status: 404 }))))
      .rejects.toThrow("avatar 404");
    await expect(characterPhotoFrom("huit", "https://tentacle.example", sources(unreadable, response({ type: "text/html; charset=utf-8" }))))
      .rejects.toThrow("text/html");
    await expect(characterPhotoFrom("huit", "https://tentacle.example", sources(unreadable, response({ bytes: new Uint8Array() }))))
      .rejects.toThrow("vide");
  });

  it("serveur injoignable ou inconnu : l'échec, sans requête hasardeuse", async () => {
    await expect(characterPhotoFrom("huit", "https://tentacle.example", sources(unreadable, new Error("réseau"))))
      .rejects.toThrow("réseau");
    const noServer = sources(unreadable, response());
    await expect(characterPhotoFrom("huit", "", noServer)).rejects.toThrow("pas de serveur");
    expect(noServer.fetcher).not.toHaveBeenCalled();
    expect(serverAvatarUrl("https://tentacle.example", "../secret")).toBeNull();
  });
});

describe("bytesToBase64", () => {
  it("rend le base64 standard, remplissage compris", () => {
    for (const length of [0, 1, 2, 3, 4, 5, 256]) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 37 + 11) % 256);
      expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
    }
  });
});
