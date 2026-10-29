/**
 * Importer un album ou des fichiers vers une playlist (règles : api-client `playlistFill.test.ts`) : les voies
 * offertes, l'entrée de la page d'une playlist, et la fin qui dit ce qui est entré, ce qui arrive, ce qui est refusé.
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ImportIntoState } from "@tentacle-tv/api-client";

const h = vi.hoisted(() => ({ album: true, files: true }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key), i18n: { language: "fr" } }),
}));
vi.mock("../../mode/useOctaveProvider", () => ({ useOctaveProvider: () => null }));
vi.mock("@tentacle-tv/api-client", async (original) => ({
  ...(await original<object>()),
  useImportInto: () => ({ albumAvailable: h.album, filesAvailable: h.files }),
}));

const { ImportModeTabs } = await import("./ImportModeTabs");
const { ImportIntoButton } = await import("./ImportIntoButton");
const { ImportIntoStatus } = await import("./ImportIntoStatus");
const { ImportFilesPane } = await import("./ImportFilesPane");

const noop = () => undefined;
const status = (state: ImportIntoState) =>
  renderToStaticMarkup(<ImportIntoStatus titleId="t" state={state} release={null} onHide={noop} onCancel={noop} onResume={noop} onOpen={noop} onRetry={noop} onClose={noop} />);

describe("les voies de la boîte « Importer »", () => {
  it("trois onglets ; une seule voie : aucun contrôle", () => {
    const html = renderToStaticMarkup(<ImportModeTabs modes={["link", "album", "files"]} value="album" onChange={noop} />);
    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(3);
    expect(html).toContain('aria-selected="true"');
    expect(renderToStaticMarkup(<ImportModeTabs modes={["link"]} value="link" onChange={noop} />)).toBe("");
  });

  it("les fichiers : un nom pour une playlist neuve, aucun pour une playlist existante", () => {
    expect(renderToStaticMarkup(<ImportFilesPane into={false} onStart={noop} onCancel={noop} />)).toContain("nameLabel");
    expect(renderToStaticMarkup(<ImportFilesPane into onStart={noop} onCancel={noop} />)).not.toContain("nameLabel");
  });
});

describe("l'entrée d'une playlist", () => {
  it("seulement si le compte peut y ajouter, et qu'une voie existe", () => {
    expect(renderToStaticMarkup(<ImportIntoButton playlistId="p" name="Route" canAdd />)).toContain("intoTitle");
    expect(renderToStaticMarkup(<ImportIntoButton playlistId="p" name="Route" canAdd={false} />)).toBe("");
    h.album = false;
    h.files = false;
    expect(renderToStaticMarkup(<ImportIntoButton playlistId="p" name="Route" canAdd />)).toBe("");
    h.album = true;
    h.files = true;
  });
});

describe("la fin", () => {
  const result = { playlistId: "pl", name: "Démos", added: 3, pending: 3, refused: 1, refusal: "quota" as const };
  it("ce qui est entré, ce qui arrive encore, ce qui est refusé, et « Ouvrir »", () => {
    const html = status({ source: "files", phase: "done", label: "Démos", result, failure: null });
    expect(html).toContain("intoDone");
    expect(html).toContain("intoPending");
    expect(html).toContain("intoRefused");
    expect(html).toContain(">open<");
  });

  it("un échec dit sa cause : ajout (ici) ou refus de la chaîne des sorties (ses mots)", () => {
    expect(status({ source: "album", phase: "failed", label: "X", result: null, failure: "empty" })).toContain("intoFailure.empty");
    expect(status({ source: "files", phase: "failed", label: null, result: null, failure: "tooLarge" })).toContain("refusal.tooLarge");
  });
});
