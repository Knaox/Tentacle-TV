import { describe, expect, it } from "vitest";
import { classifyStorage, filesystemTypeFor, parseMountInfo } from "./storageMount";

// Lignes au format de /proc/self/mountinfo (relevé d'un conteneur, chemins neutres).
const MOUNTINFO = [
  "1 0 0:1 / / rw,relatime - overlay overlay rw",
  "2 1 0:2 / /app/apps/backend/data rw,relatime - ext4 /dev/sda1 rw",
  "3 1 0:3 / /mnt/nas rw,relatime - nfs4 nas:/export rw",
  "4 3 0:4 / /mnt/nas/local\\040disk rw,relatime - btrfs /dev/sdb1 rw",
  "5 1 0:5 / /srv/share rw,relatime - cifs //box/share rw",
].join("\n");

describe("support de la base : local ou réseau", () => {
  it("lit les points de montage et leur type, espaces compris", () => {
    expect(parseMountInfo(MOUNTINFO).map((m) => [m.point, m.type])).toEqual([
      ["/", "overlay"],
      ["/app/apps/backend/data", "ext4"],
      ["/mnt/nas", "nfs4"],
      ["/mnt/nas/local disk", "btrfs"],
      ["/srv/share", "cifs"],
    ]);
  });

  it("retient le montage le plus long qui contient le chemin", () => {
    const mounts = parseMountInfo(MOUNTINFO);
    expect(filesystemTypeFor("/app/apps/backend/data/tentacle.db", mounts)).toBe("ext4");
    expect(filesystemTypeFor("/mnt/nas/tentacle.db", mounts)).toBe("nfs4");
    expect(filesystemTypeFor("/mnt/nas/local disk/tentacle.db", mounts)).toBe("btrfs");
    // « /mnt/nasx » n'est pas sous « /mnt/nas ».
    expect(filesystemTypeFor("/mnt/nasx/tentacle.db", mounts)).toBe("overlay");
  });

  it("avertit pour NFS et SMB, jamais pour un disque local", () => {
    expect(classifyStorage("/app/apps/backend/data/tentacle.db", "linux", MOUNTINFO)).toBe("local");
    expect(classifyStorage("/mnt/nas/tentacle.db", "linux", MOUNTINFO)).toBe("network");
    expect(classifyStorage("/srv/share/tentacle.db", "linux", MOUNTINFO)).toBe("network");
  });

  it("Windows : un chemin UNC est un partage réseau", () => {
    expect(classifyStorage("\\\\nas\\tentacle\\tentacle.db", "win32", null)).toBe("network");
    expect(classifyStorage("C:\\ProgramData\\Tentacle\\tentacle.db", "win32", null)).toBe("local");
  });

  it("sans relevé lisible, ne prétend rien", () => {
    expect(classifyStorage("/data/tentacle.db", "linux", null)).toBe("unknown");
    expect(classifyStorage("/data/tentacle.db", "darwin", null)).toBe("unknown");
  });
});
