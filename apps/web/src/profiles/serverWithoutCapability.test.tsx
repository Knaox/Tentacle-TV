import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PickerProfileDto, PickerProfilesDto } from "@tentacle-tv/shared";

/**
 * Un serveur sans `family.desktopProfiles` (≤ 1.27) : AUCUNE trace des
 * profils du bureau — ni changement rapide dans le menu de l'avatar, ni
 * réglage dans Réglages › Famille — et aucune requête vers ses routes.
 * Le même banc, capacité déclarée et famille de trois profils, prouve que le
 * rendu n'est pas vide par accident. React Query est remplacé par un cache de
 * banc (l'api-client et react-query tireraient une seconde copie de React) :
 * une requête « partie » est une requête activée.
 */

const state = vi.hoisted(() => ({ capable: false, desktop: true }));
const loadPickerProfiles = vi.hoisted(() => vi.fn());
const queries = vi.hoisted(() => ({ cache: new Map<string, unknown>(), started: [] as string[] }));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey: readonly unknown[]; enabled?: boolean }) => {
    const key = JSON.stringify(options.queryKey);
    if (options.enabled !== false) queries.started.push(key);
    return { data: options.enabled === false ? undefined : queries.cache.get(key), isError: false, refetch: async () => undefined };
  },
  useQueryClient: () => ({
    getQueryData: (key: readonly unknown[]) => queries.cache.get(JSON.stringify(key)),
    setQueryData: (key: readonly unknown[], value: unknown) => void queries.cache.set(JSON.stringify(key), value),
    clear: () => undefined,
  }),
  useMutation: () => ({ mutate: () => undefined, isPending: false }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "fr" } }),
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => () => undefined }));
vi.mock("@tentacle-tv/api-client", () => ({
  useServerCapability: () => state.capable,
  useAppConfig: () => ({ data: { features: { family: { v: 2, enabled: true, guests: true } } } }),
  useJellyfinClient: () => ({ getDeviceName: () => "Desktop", setAccessToken: () => undefined }),
  TentacleApiError: class extends Error {},
}));
vi.mock("../desktop/detect", () => ({ isDesktopApp: () => state.desktop }));
vi.mock("../auth/profileSession", () => ({ accountUserId: () => "owner", useActiveProfile: () => null }));
vi.mock("../watchTogether/WatchTogetherProvider", () => ({
  useWatchTogether: () => ({ isInGroup: false, actions: { leave: async () => undefined } }),
}));
vi.mock("../contexts/ToastContext", () => ({ useToast: () => ({ show: () => undefined }) }));
vi.mock("../family/FamilyAvatar", () => ({ FamilyAvatar: ({ name }: { name: string }) => <span data-avatar={name} /> }));
vi.mock("./api/pickerGateway", () => ({
  PICKER_PLATFORM: "desktop",
  pickerProfilesKey: (accountId: string | null) => ["family", "picker", accountId ?? "none"],
  loadPickerProfiles,
  pickProfile: vi.fn(),
  savePickerPreference: vi.fn(),
  NoPersonalSession: class extends Error {},
}));

const { useProfileSwitcher } = await import("./switcher/useProfileSwitcher");
const { AskAtLaunchSection } = await import("./settings/AskAtLaunchSection");
const { useAccountFaceColor } = await import("./face/useAccountFaceColor");

/** Le rond du compte : la couleur de son profil, ou « brand » (le dégradé de marque). */
function FaceProbe() {
  return <i>{useAccountFaceColor() ?? "brand"}</i>;
}

function profile(userId: string, extra: Partial<PickerProfileDto> = {}): PickerProfileDto {
  return { userId, kind: "guest", name: userId, color: "teal", hasPin: false, imageTag: null, lockedUntil: null, createdBy: null, personal: false, ...extra };
}

const LISTING: PickerProfilesDto = {
  v: 2,
  platform: "desktop",
  switches: { families: true, guests: true },
  account: { userId: "owner", name: "Damien" },
  profiles: [profile("owner", { kind: "owner", personal: true }), profile("zoe", { kind: "member", hasPin: true }), profile("lea")],
  currentProfileId: "owner",
  pickerRequired: true,
  atLaunch: false,
};

function Probe() {
  const switcher = useProfileSwitcher(() => undefined);
  return (
    <div>
      {switcher.section}
      {switcher.overlays}
      <AskAtLaunchSection />
    </div>
  );
}

const PICKER_KEY = JSON.stringify(["family", "picker", "owner"]);

function render(listing: PickerProfilesDto | null = LISTING): string {
  queries.cache.clear();
  if (listing) queries.cache.set(PICKER_KEY, listing);
  return renderToStaticMarkup(<Probe />);
}

describe("les profils du bureau face au serveur", () => {
  beforeEach(() => {
    loadPickerProfiles.mockReset();
    queries.started.length = 0;
    state.capable = false;
    state.desktop = true;
  });

  it("serveur sans la capacité : rien du tout, et aucune requête", () => {
    expect(render()).toBe("<div></div>");
    expect(queries.started).not.toContain(PICKER_KEY);
    expect(loadPickerProfiles).not.toHaveBeenCalled();
  });

  it("hors du bureau, même capacité déclarée : rien non plus", () => {
    state.capable = true;
    state.desktop = false;
    expect(render()).toBe("<div></div>");
    expect(queries.started).not.toContain(PICKER_KEY);
  });

  it("capacité déclarée, famille de trois profils : le changement rapide et le réglage", () => {
    state.capable = true;
    const html = render();
    expect(queries.started).toContain(PICKER_KEY);
    expect(html).toContain('role="menuitemradio"');
    expect(html.match(/role="menuitemradio"/g)?.length).toBe(3);
    expect(html.match(/aria-checked="true"/g)?.length).toBe(1);
    // Le cadenas du seul profil protégé ; « Gérer les profils » en session personnelle.
    expect(html.match(/lucide-lock/g)?.length).toBe(1);
    expect(html).toContain("profilePicker:manageProfiles");
    expect(html).toContain("launchSetting.title");
    expect(html).toContain('role="switch"');
  });

  it("serveur sans la capacité : le rond du compte garde la marque, sans requête", () => {
    queries.cache.clear();
    queries.cache.set(PICKER_KEY, { ...LISTING, profiles: [profile("owner", { kind: "owner", color: "orange", personal: true }), ...LISTING.profiles.slice(1)] });
    expect(renderToStaticMarkup(<FaceProbe />)).toBe("<i>brand</i>");
    expect(queries.started).not.toContain(PICKER_KEY);
  });

  it("capacité déclarée, famille : le rond du compte à la couleur de son profil", () => {
    state.capable = true;
    queries.cache.clear();
    queries.cache.set(PICKER_KEY, { ...LISTING, profiles: [profile("owner", { kind: "owner", color: "orange", personal: true }), ...LISTING.profiles.slice(1)] });
    expect(renderToStaticMarkup(<FaceProbe />)).toBe("<i>orange</i>");
  });

  it("capacité déclarée, famille d'un seul profil : rien à changer, rien à régler", () => {
    state.capable = true;
    expect(render({ ...LISTING, profiles: [LISTING.profiles[0]!], pickerRequired: false })).toBe("<div></div>");
  });
});
