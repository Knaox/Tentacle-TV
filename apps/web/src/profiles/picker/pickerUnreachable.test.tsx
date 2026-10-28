import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PickerProfile, WhoIsWatchingModel } from "./pickerTypes";

/**
 * Bogue du 28/10 (lot « Octave mobile ») : serveur injoignable sur « Qui regarde ? », l'utilisateur restait
 * sur « serveur inaccessible » avec « Réessayer » pour seul geste. Désormais : réessayer, continuer hors ligne
 * (si le compte a du contenu gardé ici), se déconnecter — jamais bloqué.
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "fr" } }),
}));
vi.mock("../../family/FamilyAvatar", () => ({ FamilyAvatar: ({ name }: { name: string }) => <span data-avatar={name} /> }));

const { WhoIsWatchingView } = await import("./WhoIsWatchingView");

const noop = () => {};
const lea: PickerProfile = { id: "lea", name: "Léa", color: "teal", imageTag: null, hasPin: true, pinLock: true, current: false, guest: false, own: false, lockedLabel: null };

function view(model: WhoIsWatchingModel, exits?: { goOffline: (() => void) | null; signOut: () => void }): string {
  return renderToStaticMarkup(
    <WhoIsWatchingView model={model} onPick={noop} onManage={noop} onRetry={noop} onDigit={noop} onErase={noop} onBack={noop} exits={exits} />,
  );
}

describe("« Qui regarde ? » sans serveur — jamais bloqué", () => {
  it("la liste illisible : réessayer, se déconnecter, et continuer hors ligne quand c'est possible", () => {
    const html = view({ kind: "error", message: "refusal.offline" }, { goOffline: noop, signOut: noop });
    expect(html).toContain("retry");
    expect(html).toContain("unreachable.signOut");
    expect(html).toContain("unreachable.goOffline");
  });

  it("sans contenu gardé (ou dans le navigateur) : pas de « hors ligne », la déconnexion reste", () => {
    const html = view({ kind: "error", message: "refusal.offline" }, { goOffline: null, signOut: noop });
    expect(html).not.toContain("unreachable.goOffline");
    expect(html).toContain("unreachable.signOut");
  });

  it("la rangée connue (miroir) mais un choix refusé faute de serveur : les mêmes sorties sous la rangée", () => {
    const model: WhoIsWatchingModel = { kind: "picker", profiles: [lea], canManage: false, notice: "refusal.offline", entering: null, unreachable: true };
    const html = view(model, { goOffline: noop, signOut: noop });
    expect(html).toContain("unreachable.goOffline");
    expect(html).toContain("unreachable.signOut");
    // En ligne, rien de tout cela.
    expect(view({ ...model, unreachable: false, notice: null }, { goOffline: noop, signOut: noop })).not.toContain("unreachable.signOut");
  });
});
