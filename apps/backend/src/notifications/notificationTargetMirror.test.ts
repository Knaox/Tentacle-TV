/**
 * Le verrou du miroir du contrat des notifications : le serveur et les clients
 * lisent la MÊME cible. La source canonique est SHARED ; on modifie là-bas, on
 * recopie ici :
 *
 *   cp packages/shared/src/notifications/notificationTarget.ts apps/backend/src/notifications/
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { describe, expect, it } from "vitest";
import { pushTapData, toNotificationDto } from "./notificationDto";

function repoRoot(): string {
  let folder = process.cwd();
  while (!existsSync(join(folder, "pnpm-workspace.yaml"))) {
    const parent = dirname(folder);
    if (parent === folder) throw new Error("racine du dépôt introuvable");
    folder = parent;
  }
  return folder;
}

const row = {
  id: "n1", jellyfinUserId: "u1", type: "request_status", title: "La Chasse", body: "« La Chasse » est en route",
  refId: "r1", read: false, createdAt: new Date("2026-10-15T09:00:00Z"),
};

describe("contrat des notifications (cible, état)", () => {
  it("notificationTarget.ts est identique octet pour octet à celui de shared", () => {
    const root = repoRoot();
    expect(readFileSync(join(root, "apps/backend/src/notifications/notificationTarget.ts"), "utf8"))
      .toBe(readFileSync(join(root, "packages/shared/src/notifications/notificationTarget.ts"), "utf8"));
  });

  it("une notification d'avant (sans colonnes) se sert sans cible ni état", () => {
    expect(toNotificationDto(row)).toMatchObject({ target: null, state: null, createdAt: "2026-10-15T09:00:00.000Z" });
    expect(pushTapData(row)).toEqual({ type: "request_status", refId: "r1" });
  });

  it("une cible stockée est servie lue, une cible abîmée devient null", () => {
    const target = { kind: "extension", pluginId: "seer", path: "/discover", params: { tab: "requests" } };
    const dto = toNotificationDto({ ...row, target: JSON.stringify(target), state: "progress" });
    expect(dto.target).toEqual(target);
    expect(dto.state).toBe("progress");
    expect(pushTapData({ ...row, target: JSON.stringify(target) })).toEqual({ type: "request_status", refId: "r1", target });
    expect(toNotificationDto({ ...row, target: "{oops", state: "downloading" })).toMatchObject({ target: null, state: null });
  });
});
