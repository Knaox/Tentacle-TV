import { describe, expect, it } from "vitest";
import { readDeployment, suggestedJellyfinUrl } from "./deployment";

describe("installation lue dans l'environnement", () => {
  it("pile complète : le Jellyfin voisin, ses médias sous /media", () => {
    const d = readDeployment({
      TENTACLE_DEPLOYMENT: "docker",
      TENTACLE_STACK: "full",
      JELLYFIN_INTERNAL_URL: "http://jellyfin:8096/",
      TENTACLE_MEDIA_HOST_PATH: "./media",
    });
    expect(d).toEqual({
      deployment: "docker",
      stack: "full",
      provisioner: "docker-sibling",
      siblingUrl: "http://jellyfin:8096",
      mediaFolders: { root: "/media", movies: "/media/films", tvshows: "/media/series" },
      mediaHostPath: "./media",
    });
    expect(suggestedJellyfinUrl(d)).toBe("http://jellyfin:8096");
  });

  it("les sous-dossiers suivent ceux du service init", () => {
    const d = readDeployment({
      TENTACLE_DEPLOYMENT: "docker", TENTACLE_STACK: "full", JELLYFIN_INTERNAL_URL: "http://jellyfin:8096",
      TENTACLE_MEDIA_SUBDIRS: "movies, shows",
    });
    expect(d.mediaFolders).toEqual({ root: "/media", movies: "/media/movies", tvshows: "/media/shows" });
  });

  it("piles « base » et « seule » : un Jellyfin existant, sur la machine par défaut", () => {
    for (const stack of ["db", "only"]) {
      const d = readDeployment({ TENTACLE_DEPLOYMENT: "docker", TENTACLE_STACK: stack });
      expect(d.provisioner).toBe("existing-instance");
      expect(d.siblingUrl).toBeNull();
      expect(suggestedJellyfinUrl(d)).toBe("http://host.docker.internal:8096");
    }
  });

  it("l'ancien compose (image sans pile) : rien à proposer d'office", () => {
    const d = readDeployment({ TENTACLE_DEPLOYMENT: "docker" });
    expect(d.stack).toBeNull();
    expect(d.provisioner).toBe("existing-instance");
    expect(suggestedJellyfinUrl(d)).toBeNull();
  });

  it("natif : Jellyfin cherché sur la machine", () => {
    const d = readDeployment({});
    expect(d.deployment).toBe("native");
    expect(d.provisioner).toBe("native-host");
    expect(suggestedJellyfinUrl(d)).toBe("http://127.0.0.1:8096");
  });

  it("une pile inconnue ou une adresse de voisin hors pile complète sont ignorées", () => {
    expect(readDeployment({ TENTACLE_DEPLOYMENT: "docker", TENTACLE_STACK: "managed" }).stack).toBeNull();
    const d = readDeployment({ TENTACLE_DEPLOYMENT: "docker", TENTACLE_STACK: "db", JELLYFIN_INTERNAL_URL: "http://jellyfin:8096" });
    expect(d.siblingUrl).toBeNull();
  });

  it("aucun environnement ne choisit « géré par Tentacle » (réservé)", () => {
    for (const env of [{}, { TENTACLE_DEPLOYMENT: "docker" }, { TENTACLE_DEPLOYMENT: "managed-by-tentacle" }]) {
      expect(readDeployment(env).provisioner).not.toBe("managed-by-tentacle");
    }
  });
});
