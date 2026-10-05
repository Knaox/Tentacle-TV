import { describe, expect, it } from "vitest";
import { idempotentDdl } from "./idempotentDdl";

describe("schéma complet rejouable", () => {
  it("ajoute IF NOT EXISTS aux créations de table et d'index", () => {
    expect(idempotentDdl("CREATE TABLE `server_config` (\n  `key` varchar(191) NOT NULL\n)")).toBe(
      "CREATE TABLE IF NOT EXISTS `server_config` (\n  `key` varchar(191) NOT NULL\n)",
    );
    expect(idempotentDdl("CREATE INDEX `a_b_idx` ON `a`(`b`)")).toBe("CREATE INDEX IF NOT EXISTS `a_b_idx` ON `a`(`b`)");
    expect(idempotentDdl("CREATE UNIQUE INDEX `a_c_key` ON `a`(`c`)")).toBe("CREATE UNIQUE INDEX IF NOT EXISTS `a_c_key` ON `a`(`c`)");
  });

  it("rend rejouable une clé étrangère (syntaxe MariaDB)", () => {
    const fk =
      "ALTER TABLE `ticket_messages` ADD CONSTRAINT `ticket_messages_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `support_tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE";
    expect(idempotentDdl(fk)).toBe(
      "ALTER TABLE `ticket_messages` ADD CONSTRAINT `ticket_messages_ticketId_fkey` FOREIGN KEY IF NOT EXISTS (`ticketId`) REFERENCES `support_tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE",
    );
  });

  it("ne double jamais IF NOT EXISTS, et ne touche pas au reste", () => {
    const already = "CREATE TABLE IF NOT EXISTS `x` (id int)";
    expect(idempotentDdl(already)).toBe(already);
    expect(idempotentDdl(idempotentDdl("CREATE INDEX `i` ON `x`(id)"))).toBe("CREATE INDEX IF NOT EXISTS `i` ON `x`(id)");
    expect(idempotentDdl("UPDATE `x` SET a = 'CREATE TABLE y'")).toBe("UPDATE `x` SET a = 'CREATE TABLE y'");
  });
});
