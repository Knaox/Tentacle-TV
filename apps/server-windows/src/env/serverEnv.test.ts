import { describe, expect, it } from "vitest";
import { buildServerEnv, readEnv, systemPath } from "./serverEnv";

const machine = {
  SYSTEMROOT: "C:\\Windows",
  Path: "C:\\Program Files\\Git\\usr\\bin;C:\\Users\\x\\AppData\\Local\\Microsoft\\WindowsApps",
  TEMP: "C:\\Users\\x\\AppData\\Local\\Temp",
  DATABASE_URL: "mysql://root@db/tentacle",
  DB_HOST: "db",
  NODE_OPTIONS: "--inspect",
  USERPROFILE: "C:\\Users\\x",
};

describe("buildServerEnv", () => {
  const env = buildServerEnv({
    source: machine,
    port: 3100,
    dataDir: "C:\\ProgramData\\Tentacle Server",
    cacheDir: "C:\\ProgramData\\Tentacle Server\\cache",
  });

  it("n'hérite de rien hors de la liste blanche", () => {
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.DB_HOST).toBeUndefined();
    expect(env.NODE_OPTIONS).toBeUndefined();
    expect(env.TEMP).toBe(machine.TEMP);
    expect(env.USERPROFILE).toBe(machine.USERPROFILE);
  });

  it("pose ce que pose le Dockerfile, et la plateforme Windows", () => {
    expect(env).toMatchObject({
      NODE_ENV: "production",
      PORT: "3100",
      HOST: "0.0.0.0",
      TENTACLE_DEPLOYMENT: "windows-app",
      TENTACLE_DATA_DIR: "C:\\ProgramData\\Tentacle Server",
      XDG_CACHE_HOME: "C:\\ProgramData\\Tentacle Server\\cache",
    });
  });

  it("recompose un PATH système, jamais celui de l'utilisateur", () => {
    expect(env.PATH).not.toContain("Git");
    expect(env.PATH).not.toContain("WindowsApps");
    expect(env.PATH?.split(";")[0]).toBe("C:\\Windows\\System32");
  });

  it("ne pose Python et yt-dlp que s'ils sont fournis", () => {
    expect(env.TENTACLE_PYTHON).toBeUndefined();
    const packaged = buildServerEnv({
      source: machine,
      port: 3000,
      dataDir: "D",
      cacheDir: "C",
      python: "P\\python.exe",
      ytDlpPinned: "T\\yt-dlp",
      extraPath: ["P"],
    });
    expect(packaged.TENTACLE_PYTHON).toBe("P\\python.exe");
    expect(packaged.TENTACLE_YTDLP_PINNED).toBe("T\\yt-dlp");
    expect(packaged.PATH?.startsWith("P;")).toBe(true);
  });

  it("garde un SystemRoot même absent de la session", () => {
    expect(buildServerEnv({ source: {}, port: 1, dataDir: "D", cacheDir: "C" }).SystemRoot).toBe("C:\\Windows");
  });
});

describe("readEnv / systemPath", () => {
  it("lit sans tenir compte de la casse et ignore le vide", () => {
    expect(readEnv({ systemroot: "X" }, "SystemRoot")).toBe("X");
    expect(readEnv({ TEMP: "" }, "TEMP")).toBeUndefined();
  });

  it("retire la barre finale de SystemRoot", () => {
    expect(systemPath("C:\\Windows\\")).toContain("C:\\Windows\\System32;C:\\Windows;");
  });
});
