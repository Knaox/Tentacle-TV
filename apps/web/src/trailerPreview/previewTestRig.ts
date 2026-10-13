/**
 * Le banc des tests du crochet de l'aperçu (`useTrailerPreview*.test.ts`) :
 * des cartes montées pour de vrai (React, sans DOM, conteneur factice), le
 * temps factice, la requête simulée. Les `vi.mock` restent dans chaque fichier
 * de test (vitest ne les remonte que là) ; ce module n'est pas un test.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vitest";
import type { TrailerPreviewSubject } from "@tentacle-tv/shared";
import type { TrailerPreviewHandle } from "./previewTypes";

/** L'état de la requête simulée, que chaque fichier de test tient (`vi.hoisted`). */
export interface SimulatedStream {
  result: unknown;
  fresh: boolean;
  receivedAt: number;
  loading: boolean;
}

export const METROPOLIS: TrailerPreviewSubject = { kind: "item", itemId: "90d50b74d48412cfc9db9a256b1d0c64" };
export const KID: TrailerPreviewSubject = { kind: "item", itemId: "5ced6d65a7c6c207a2b1b872fd1d4e09" };
export const FOUND = {
  status: "found",
  preview: {
    ytId: "FFUGtw7uzB4", path: "/api/trailers/hls/FFUGtw7uzB4/master.m3u8?t=abc", mimeType: "application/vnd.apple.mpegurl",
    expiresAt: Date.now() + 3_600_000, heights: [720, 1080], qualities: [],
  },
};

const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.window ??= globalThis;
const doc: Record<string, unknown> = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {} };
doc.defaultView = { document: doc, HTMLIFrameElement: class {} };
const container = () => ({
  nodeType: 1, tagName: "DIV", nodeName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml",
  ownerDocument: doc, addEventListener() {}, removeEventListener() {},
});

type Hook = (subject: TrailerPreviewSubject | null, hovered: boolean) => TrailerPreviewHandle;
type Props = { subject: TrailerPreviewSubject | null; hovered: boolean };

export function createPreviewRig(useTrailerPreview: Hook, stream: SimulatedStream) {
  const handles: Record<string, TrailerPreviewHandle> = {};
  const roots = new Map<string, Root>();
  const props = new Map<string, Props>();

  function Rig({ name, subject, hovered }: { name: string } & Props) {
    handles[name] = useTrailerPreview(subject, hovered);
    return null;
  }

  async function render(name: string, next: Partial<Props> = {}) {
    const current = { subject: METROPOLIS, hovered: false, ...props.get(name), ...next };
    props.set(name, current);
    if (!roots.has(name)) roots.set(name, createRoot(container() as never));
    await act(async () => roots.get(name)!.render(createElement(Rig, { name, ...current })));
  }

  /** Le temps passe (minuteries du crochet comprises). */
  async function wait(ms: number) {
    await act(async () => {
      vi.advanceTimersByTime(ms);
    });
  }

  /** La requête répond (une réponse NEUVE : son instant avance) ; le crochet la relit au rendu suivant. */
  async function serve(result: unknown, name = "a") {
    stream.result = result;
    stream.fresh = result !== undefined;
    stream.receivedAt = Math.max(Date.now(), stream.receivedAt + 1);
    stream.loading = false;
    await render(name);
  }

  async function cleanup() {
    for (const root of roots.values()) await act(async () => root.unmount());
    roots.clear();
    props.clear();
  }

  return { handles, render, wait, serve, cleanup };
}
