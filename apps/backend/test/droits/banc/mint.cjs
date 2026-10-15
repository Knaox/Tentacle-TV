// Banc des droits : un jeton de TV jumelée (ligne paired_devices posée) et un « voir en
// tant que » pour un compte — dans un processus à part du backend (cf. README).
//   node mint.cjs <apps/backend> <dossier de données> <id du compte> > tokens.json
/* eslint-disable @typescript-eslint/no-require-imports -- script de banc : charge le code du worktree visé */
const { DatabaseSync } = require("node:sqlite");
const { createHash, randomBytes } = require("node:crypto");
const path = require("node:path");
const [backendDir, dataDir, userId] = process.argv.slice(2);
const jwt = require(require.resolve("jsonwebtoken", { paths: [backendDir] }));
const db = new DatabaseSync(path.join(dataDir, "tentacle.db"));
const secret = db.prepare(`SELECT value FROM server_config WHERE key = 'jwt_secret'`).get().value;
const device = jwt.sign({ userId, username: "enfant", isAdmin: false, deviceId: "banc-tv", type: "paired_device" }, secret);
const hash = createHash("sha256").update(device).digest("hex");
const now = Date.now();
db.prepare(`INSERT INTO paired_devices (id, name, jellyfinUserId, username, tokenHash, lastSeen, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`)
  .run(randomBytes(8).toString("hex"), "TV du banc", userId, "enfant", hash, now, now);
const viewAs = jwt.sign({ userId, username: "enfant", isAdmin: false, adminUserId: "x", type: "impersonation" }, secret, { expiresIn: "8h" });
console.log(JSON.stringify({ device, viewAs }));
