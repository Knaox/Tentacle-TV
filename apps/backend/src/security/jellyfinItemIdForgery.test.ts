/**
 * Un identifiant de titre ne devient jamais un CHEMIN chez Jellyfin : un
 * `itemId` qui remonte (`../System/Configuration`) ou qui ajoute des
 * paramètres ne doit déclencher aucune requête — surtout pas sous la clé
 * d'administration (`getItemDetail`, fiche publique de partage).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.invalid",
  getJellyfinApiKey: () => "admin-key",
}));

import { getItemDetail } from "../services/jellyfin";
import { getItemLibraryId } from "../services/jellyfinPolicy";

const FORGED = ["../System/Configuration", "..%2FAuth%2FKeys", "abc?userId=x", "0123456789abcdef0123456789abcdef/../../Users"];
const VALID = "0123456789abcdef0123456789abcdef";

describe("identifiant de titre forgé", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  it.each(FORGED)("getItemLibraryId(%s) n'appelle pas Jellyfin", async (id) => {
    expect(await getItemLibraryId("user-token", id)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(FORGED)("getItemDetail(%s) refuse sans appeler Jellyfin", async (id) => {
    await expect(getItemDetail("owner", id)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("un identifiant valide part toujours, avec ou sans tirets", async () => {
    await getItemLibraryId("user-token", VALID);
    await getItemLibraryId("user-token", "01234567-89ab-cdef-0123-456789abcdef");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`http://jf.invalid/Items/${VALID}/Ancestors`);
  });
});
