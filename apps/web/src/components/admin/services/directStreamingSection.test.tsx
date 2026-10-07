import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * « Lecture directe » des Services : les règles de l'accès à distance —
 * l'adresse privée suffit, la publique est facultative (un interrupteur) —
 * seulement si le serveur déclare `admin.remoteExposure` ; sinon, les deux
 * adresses restent exigées, comme le veut un serveur d'avant.
 */
const h = vi.hoisted(() => ({ exposure: true, config: { enabled: true, publicUrl: "", privateUrl: "" } }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: async () => undefined }),
  useMutation: () => ({ mutate: () => undefined, isPending: false }),
}));
vi.mock("@tentacle-tv/api-client", () => ({ useServerCapability: () => h.exposure }));
vi.mock("../../../contexts/ToastContext", () => ({ useToast: () => ({ show: () => undefined }) }));
vi.mock("../../../pages/adminUtils", () => ({ cls: new Proxy({}, { get: (_t, name) => `cls-${String(name)}` }), BACKEND: "", creds: () => undefined, hdrs: () => ({}) }));
vi.mock("./useServicesData", () => ({ useDirectStreamingConfig: () => ({ data: h.config, isError: false }), useExplainFailure: () => () => "" }));
vi.mock("./useUnsavedGuard", () => ({ useUnsavedGuard: () => undefined }));
vi.mock("./servicesApi", () => ({ servicesApi: {} }));
vi.stubGlobal("window", { location: { protocol: "http:", hostname: "192.168.1.20", host: "192.168.1.20:3471" } });

const { DirectStreamingSection } = await import("./DirectStreamingSection");

beforeEach(() => {
  h.exposure = true;
  h.config = { enabled: true, publicUrl: "", privateUrl: "" };
});

describe("la lecture directe des Services", () => {
  it("serveur à jour : l'adresse privée d'abord, la publique derrière un interrupteur, coupé sans adresse publique", () => {
    h.config = { enabled: true, publicUrl: "", privateUrl: "http://192.168.1.20:8096" };
    const html = renderToStaticMarkup(<DirectStreamingSection />);
    expect(html).toContain("directPublicSwitch");
    expect(html).not.toContain("directPublicLabel");
    expect(html).not.toContain("directUrlsRequired");
    expect(html).not.toContain("directPrivateRequired");
  });

  it("allumée sans adresse privée : c'est elle qui manque, pas la publique", () => {
    const html = renderToStaticMarkup(<DirectStreamingSection />);
    expect(html).toContain("directPrivateRequired");
  });

  it("une adresse publique réglée : l'interrupteur est allumé, le champ montré", () => {
    h.config = { enabled: true, publicUrl: "https://jf.example.com", privateUrl: "http://192.168.1.20:8096" };
    const html = renderToStaticMarkup(<DirectStreamingSection />);
    expect(html).toContain("directPublicLabel");
    expect(html).toContain('aria-checked="true"');
  });

  it("serveur d'avant : les deux adresses, toutes deux exigées", () => {
    h.exposure = false;
    h.config = { enabled: true, publicUrl: "", privateUrl: "http://192.168.1.20:8096" };
    const html = renderToStaticMarkup(<DirectStreamingSection />);
    expect(html).not.toContain("directPublicSwitch");
    expect(html).toContain("directPublicLabel");
    expect(html).toContain("directUrlsRequired");
  });
});
