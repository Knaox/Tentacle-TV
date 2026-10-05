import { describe, expect, it } from "vitest";
import { classifyProbe } from "./jellyfinHealthProbe";

/** Les réponses MESURÉES sur Jellyfin 10.11.11 pendant un redémarrage, et leur verdict. */

const REAL =
  '{"LocalAddress":"http://172.17.0.2:8096","ServerName":"ceebc469d8d2","Version":"10.11.11","ProductName":"Jellyfin Server","OperatingSystem":"","Id":"c6b9ac4892d3472798113fe8dd6fb601","StartupWizardCompleted":true}';
/** Le serveur d'attente de 10.11, une fois, au démarrage : camelCase, sans `Id`. */
const SETUP_SERVER = '{"localAddress":"http://172.17.0.2:8096","serverName":"ceebc469d8d2","version":"10.11.11"}';

describe("sonde de santé de Jellyfin", () => {
  it("le vrai serveur : PascalCase avec son Id", () => {
    expect(classifyProbe(200, REAL)).toBe("ok");
  });

  it("le 200 transitoire du serveur d'attente n'est pas un retour", () => {
    expect(classifyProbe(200, SETUP_SERVER)).toBe("starting");
  });

  it("503 « Jellyfin Server is loading » : il démarre", () => {
    expect(classifyProbe(503, "Jellyfin Server is loading. Please try again shortly.")).toBe("starting");
  });

  it("toute autre réponse, ou un corps illisible : échec", () => {
    expect(classifyProbe(502, "Bad Gateway")).toBe("fail");
    expect(classifyProbe(404, "")).toBe("fail");
    expect(classifyProbe(200, "<html>proxy</html>")).toBe("fail");
  });
});
