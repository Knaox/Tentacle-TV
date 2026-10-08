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

  it("conteneur LXC Proxmox sur Ceph RBD : un disque BLOC formaté en local, aucune alerte", () => {
    // Relevé de la forme d'un LXC Proxmox : racine et volume Docker sur /dev/rbd1 (ext4).
    const lxc = [
      "21 1 252:16 / / rw,relatime - ext4 /dev/rbd1 rw",
      "60 21 252:16 /var/lib/docker/volumes/tentacle-data/_data /app/apps/backend/data rw,relatime - ext4 /dev/rbd1 rw",
      "61 21 0:50 / /mnt/xfs rw - xfs /dev/rbd2 rw",
      "62 21 0:51 / /mnt/btrfs rw - btrfs /dev/rbd3 rw",
      "63 21 0:52 / /mnt/zfs rw - zfs rpool/data/subvol-101-disk-0 rw",
      "64 21 0:53 / /mnt/cephfs rw - ceph 10.0.0.1:6789:/ rw",
      "65 21 0:54 / /mnt/cephfuse rw - fuse.ceph-fuse ceph-fuse rw",
      "66 21 0:55 / /mnt/gluster rw - glusterfs gluster:/vol rw",
      "67 21 0:56 / /mnt/sshfs rw - fuse.sshfs user@host:/ rw",
      "68 21 0:57 / /mnt/9p rw - 9p data rw",
      "69 21 0:58 / /mnt/smb3 rw - smb3 //box/share rw",
    ].join("\n");
    for (const dir of ["/app/apps/backend/data", "/mnt/xfs", "/mnt/btrfs", "/mnt/zfs", "/srv"]) {
      expect(classifyStorage(`${dir}/tentacle.db`, "linux", lxc), dir).toBe("local");
    }
    for (const dir of ["/mnt/cephfs", "/mnt/cephfuse", "/mnt/gluster", "/mnt/sshfs", "/mnt/9p", "/mnt/smb3"]) {
      expect(classifyStorage(`${dir}/tentacle.db`, "linux", lxc), dir).toBe("network");
    }
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
