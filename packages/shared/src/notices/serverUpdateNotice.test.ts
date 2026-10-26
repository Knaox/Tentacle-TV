import { describe, expect, it } from "vitest";
import { SERVER_CAPABILITIES, SERVER_CAPABILITY_KEYS, newestMissingSince } from "../serverCapabilities/serverCapabilities";
import {
  compareAppVersions, isServerOutdated, isServerUpdateMasked, newestPublishedMissingSince, serverNewsNotice, serverUpdateNotice,
} from "./serverUpdateNotice";

/**
 * « Serveur à mettre à jour » : la comparaison des versions, l'avertissement
 * OBLIGATOIRE sous l'exigence du client (jamais masquable), et l'INVITATION
 * quand une nouveauté du client attend un serveur plus récent — masquée
 * jusqu'aux prochaines nouveautés.
 */

/** La nouveauté la plus récente de la liste : elle bouge à chaque clé ajoutée, le test non. */
const NEWEST = newestMissingSince(new Set())!;
describe("serveur à mettre à jour", () => {
  it("compare les versions segment par segment, les manquants valant zéro", () => {
    expect(compareAppVersions("1.22.3", "1.22.10")).toBeLessThan(0);
    expect(compareAppVersions("1.23.0", "1.22.99")).toBeGreaterThan(0);
    expect(compareAppVersions("1.22", "1.22.0")).toBe(0);
    expect(compareAppVersions("v1.22.1", "1.22.1")).toBe(0);
    expect(compareAppVersions("1.22.1-beta", "1.22.1")).toBe(0);
    expect(compareAppVersions("dev", "1.0.0")).toBeLessThan(0);
  });

  it("le serveur est en retard sous l'exigence du client, jamais sur une version inconnue", () => {
    expect(isServerOutdated("1.22.0", "1.22.1")).toBe(true);
    expect(isServerOutdated("1.22.1", "1.22.1")).toBe(false);
    expect(isServerOutdated("1.23.0", "1.22.1")).toBe(false);
    expect(isServerOutdated(null, "1.22.1")).toBe(false);
    expect(isServerOutdated(undefined, "1.22.1")).toBe(false);
  });

  it("le masquage tient tant que l'exigence retenue couvre celle d'aujourd'hui", () => {
    expect(isServerUpdateMasked("1.23.0", "1.23.0")).toBe(true);
    expect(isServerUpdateMasked("1.23.0", "1.22.1")).toBe(true);
    // Une exigence plus haute arrive (client mis à jour) : il cède.
    expect(isServerUpdateMasked("1.23.0", "1.24.0")).toBe(false);
    // Masqué sans marque lisible : au pire, l'avertissement revient.
    expect(isServerUpdateMasked("", "1.23.0")).toBe(false);
    expect(isServerUpdateMasked(null, "1.23.0")).toBe(false);
  });

  it("l'obligatoire : admin seulement, serveur sous l'exigence, jamais masquable", () => {
    const base = { serverVersion: "1.22.0", minServer: "1.23.0", isAdmin: true };
    expect(serverUpdateNotice(base)).toEqual({ outdated: true, show: true });
    expect(serverUpdateNotice({ ...base, isAdmin: false }).show).toBe(false);
    expect(serverUpdateNotice({ ...base, serverVersion: "1.23.0" }).show).toBe(false);
    expect(serverUpdateNotice({ ...base, serverVersion: null }).show).toBe(false);
  });

  it("l'invitation : une nouveauté du client attend un serveur plus récent", () => {
    const none = new Set<never>();
    const base = { serverVersion: "1.23.0", minServer: "1.23.0", isAdmin: true, capabilities: none, dismissal: null, latestPublished: NEWEST };
    expect(serverNewsNotice(base)).toEqual({ available: true, masked: false, show: true, mark: NEWEST });
    expect(serverNewsNotice({ ...base, isAdmin: false }).show).toBe(false);
    // Un serveur qui déclare tout : rien à proposer.
    expect(serverNewsNotice({ ...base, capabilities: new Set(SERVER_CAPABILITY_KEYS) })).toMatchObject({ available: false, show: false, mark: null });
    // Sous l'exigence, c'est l'obligatoire qui parle.
    expect(serverNewsNotice({ ...base, serverVersion: "1.22.0" }).show).toBe(false);
    // Rien tant que la version, les capacités ou le masquage ne sont pas lus.
    expect(serverNewsNotice({ ...base, serverVersion: null }).show).toBe(false);
    expect(serverNewsNotice({ ...base, capabilities: undefined }).show).toBe(false);
    expect(serverNewsNotice({ ...base, dismissal: undefined }).show).toBe(false);
    expect(serverNewsNotice({ ...base, latestPublished: undefined }).show).toBe(false);
  });

  it("seulement vers une version PUBLIÉE : du code livré en avance (1.40.0) n'annonce rien tant qu'elle n'est pas sortie", () => {
    // Le serveur 1.31.4 tait les clés de 1.40.0 ; le client de `dev` les connaît.
    const declared = new Set(SERVER_CAPABILITY_KEYS.filter((key) => compareAppVersions(SERVER_CAPABILITIES[key], "1.31.4") <= 0));
    const base = { serverVersion: "1.31.4", minServer: "1.23.0", isAdmin: true, capabilities: declared, dismissal: null };
    expect(serverNewsNotice({ ...base, latestPublished: "1.31.4" })).toMatchObject({ available: false, show: false, mark: null });
    expect(serverNewsNotice({ ...base, latestPublished: "1.40.0" })).toMatchObject({ available: true, show: true, mark: "1.40.0" });
    // Dernière publiée inconnue : le plafond est la version du serveur lui-même — rien plutôt qu'une fausse nouveauté.
    expect(serverNewsNotice({ ...base, latestPublished: null })).toMatchObject({ available: false, show: false });
    // Une nouveauté publiée plus ancienne que la plus récente du client : c'est elle qu'on annonce (et qu'on retient).
    expect(newestPublishedMissingSince(new Set(), "1.31.1")).toBe("1.31.1");
  });

  it("l'invitation masquée jusqu'aux prochaines nouveautés", () => {
    const base = { serverVersion: "1.23.0", minServer: "1.23.0", isAdmin: true, capabilities: new Set<never>(), latestPublished: NEWEST };
    expect(serverNewsNotice({ ...base, dismissal: NEWEST })).toMatchObject({ masked: true, show: false });
    // Une marque d'avant (l'exigence 1.23.0 retenue par l'ancien avertissement) ne couvre pas les nouveautés d'après.
    expect(serverNewsNotice({ ...base, dismissal: "1.23.0" })).toMatchObject({ masked: false, show: true });
  });
});
