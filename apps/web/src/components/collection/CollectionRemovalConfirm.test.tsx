import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Le retrait EN LOT de Ma liste ou des favoris se confirme (un seul appui
 * retirait toute la sélection) : le dialogue dit QUOI, COMBIEN, et que rien
 * ne quitte la bibliothèque ; la barre dit « Retirer », jamais « Supprimer ».
 * Rendu à plat : `t()` rend la clé et ses paramètres.
 */
const seen = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number }) => (opts?.count === undefined ? key : `${key}#${opts.count}`),
  }),
}));
vi.mock("../ui/ConfirmDialog", () => ({
  ConfirmDialog: (props: Record<string, unknown>) => {
    seen.props.push(props);
    return null;
  },
}));
vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  createPortal: (node: unknown) => node,
}));

// La barre vise `document.body` : un corps factice suffit, le portail rend sur place.
vi.stubGlobal("document", { body: {} });

const { CollectionRemovalDialog } = await import("./CollectionRemovalConfirm");
const { SelectionToolbar } = await import("../SelectionToolbar");

const closed = { open: false, request: () => undefined, cancel: () => undefined, confirm: () => undefined };

describe("confirmation du retrait en lot", () => {
  it("Ma liste : la question nomme la liste et le nombre, le bouton est rouge", () => {
    seen.props.length = 0;
    renderToStaticMarkup(<CollectionRemovalDialog kind="watchlist" count={4} confirmation={{ ...closed, open: true }} />);
    expect(seen.props[0]).toMatchObject({
      open: true,
      title: "removeFromWatchlistTitle#4",
      message: "removeFromCollectionBody",
      confirmLabel: "removeCount#4",
      danger: true,
    });
  });

  it("Favoris : sa propre question", () => {
    seen.props.length = 0;
    renderToStaticMarkup(<CollectionRemovalDialog kind="favorites" count={1} confirmation={closed} />);
    expect(seen.props[0]).toMatchObject({ open: false, title: "removeFromFavoritesTitle#1" });
  });

  it("la barre d'une liste dit « Retirer », celle des tickets garde « Supprimer »", () => {
    const bar = (removal: boolean) => renderToStaticMarkup(
      <SelectionToolbar count={4} onSelectAll={() => undefined} onCancel={() => undefined} onDelete={() => undefined} isDeleting={false} removal={removal} />,
    );
    expect(bar(true)).toContain("common:removeCount#4");
    expect(bar(false)).toContain("common:deleteCount#4");
  });
});
