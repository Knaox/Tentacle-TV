import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * « Regarder ensemble » sur une fiche : une règle, lue par la capsule du bureau
 * et la pilule du miroir.
 */
const h = vi.hoisted(() => ({
  wt: { isInGroup: false, isHost: false, mayCreate: true, elsewhere: null as unknown, actions: {} },
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../contexts/ToastContext", () => ({ useToast: () => ({ show: () => undefined }) }));
vi.mock("./roomModalStore", () => ({ openRoomModal: () => undefined }));
vi.mock("./WatchTogetherProvider", () => ({ useWatchTogether: () => h.wt }));

import { useWtDetailAction } from "./useWtDetailAction";

function Probe({ type = "Movie" }: { type?: string }) {
  const action = useWtDetailAction({ Id: "m1", Type: type } as MediaItem);
  return <i data-label={action?.label ?? "none"} data-active={action?.active ? "1" : "0"} />;
}
const label = (type?: string) => /data-label="([^"]*)"/.exec(renderToStaticMarkup(<Probe type={type} />))?.[1];

describe("useWtDetailAction", () => {
  beforeEach(() => {
    h.wt = { isInGroup: false, isHost: false, mayCreate: true, elsewhere: null, actions: {} };
  });

  it("hors groupe : regarder ensemble ; jamais sur une collection ni sans droit de créer", () => {
    expect(label()).toBe("watchTogetherAction");
    expect(label("BoxSet")).toBe("none");
    h.wt.mayCreate = false;
    expect(label()).toBe("none");
  });

  it("en groupe : l'hôte invite, un membre n'a rien", () => {
    h.wt.isInGroup = true;
    expect(label()).toBe("none");
    h.wt.isHost = true;
    expect(label()).toBe("invite");
  });

  it("un groupe du compte sur un autre appareil : rejoindre ici", () => {
    h.wt.elsewhere = { groupId: "g" };
    expect(label()).toBe("elsewhereJoinHere");
  });
});
