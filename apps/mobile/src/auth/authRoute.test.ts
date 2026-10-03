import { describe, expect, it } from "vitest";
import { resolveAuthRoute, type AuthState } from "./authRoute";

const USER = JSON.stringify({ Id: "b52628a704304f06a682f6037183b976", Name: "Knaoxtest" });

const state = (patch: Partial<AuthState>): AuthState => ({
  segments: ["(auth)", "server-setup"],
  serverUrl: "https://tv.example",
  token: "jeton",
  user: USER,
  sessionExpired: false,
  ...patch,
});

describe("resolveAuthRoute", () => {
  it("envoie au choix du serveur tant qu'il n'y a pas d'adresse", () => {
    expect(resolveAuthRoute(state({ serverUrl: null, segments: [] }))).toBe("/(auth)/server-setup");
    expect(resolveAuthRoute(state({ serverUrl: null, segments: ["(auth)", "login"] }))).toBe("/(auth)/server-setup");
    expect(resolveAuthRoute(state({ serverUrl: null }))).toBeNull();
  });

  it("ouvre l'accueil d'une session complète", () => {
    expect(resolveAuthRoute(state({}))).toBe("/(tabs)");
    expect(resolveAuthRoute(state({ segments: ["(tabs)"] }))).toBeNull();
  });

  it("n'ouvre pas l'accueil sur un jeton sans profil (réinstallation iOS)", () => {
    expect(resolveAuthRoute(state({ user: null }))).toBeNull();
    expect(resolveAuthRoute(state({ user: null, segments: ["(tabs)"] }))).toBe("/(auth)/login");
    expect(resolveAuthRoute(state({ user: "{\"Name\":\"sans Id\"}", segments: ["(tabs)"] }))).toBe("/(auth)/login");
  });

  it("renvoie à la connexion sans jeton, hors du groupe d'authentification", () => {
    expect(resolveAuthRoute(state({ token: null, segments: ["(tabs)"] }))).toBe("/(auth)/login");
    expect(resolveAuthRoute(state({ token: null, segments: ["(auth)", "register"] }))).toBeNull();
  });

  it("laisse la connexion tenter la reprise d'une session expirée", () => {
    expect(resolveAuthRoute(state({ segments: ["(auth)", "login"], sessionExpired: true }))).toBeNull();
  });
});
