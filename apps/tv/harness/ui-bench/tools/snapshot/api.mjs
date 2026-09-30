// Les appels de l'instantané, avec les mêmes en-têtes que l'app TV : Jellyfin
// par le proxy du backend (`/api/jellyfin`, jeton dans X-Emby-Token), le
// backend Tentacle en Bearer. Lecture seule : aucune méthode autre que GET.
// Le nom d'appareil annoncé (« Banc UI ») n'est pas un nom de TV : le backend
// ne renomme donc pas l'appareil qui porte le jeton.
import fs from "node:fs";
import path from "node:path";

const CONCURRENCY = 6;

export function createApi({ server, token }) {
  const jellyfinBase = `${server}/api/jellyfin`;
  const embyAuthorization =
    `MediaBrowser Client="Tentacle TV - Banc UI", Device="Banc UI", DeviceId="banc-ui-snapshot", Version="1.4.0", Token="${token}"`;
  const mask = (url) => url.split(token).join("…");

  async function getJson(url, headers) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`${res.status} sur ${mask(url)}`);
    return res.json();
  }

  return {
    jellyfin: (pathname) => getJson(`${jellyfinBase}${pathname}`, {
      "X-Emby-Token": token,
      "X-Emby-Authorization": embyAuthorization,
      "Accept-Language": "fr",
    }),
    tentacle: (pathname) => getJson(`${server}${pathname}`, { Authorization: `Bearer ${token}` }),
    /** Une requête qui peut échouer sans compromettre l'instantané. */
    optional: async (promise, label) => {
      try {
        return await promise;
      } catch (error) {
        console.warn(`  ⚠ ${label} : ${error.message}`);
        return null;
      }
    },
    /** Télécharge une image Jellyfin ; rend l'extension, ou null si absente. */
    async download(pathname, fileWithoutExt) {
      const url = `${jellyfinBase}${pathname}`;
      let res = await fetch(url);
      if (res.status === 401) res = await fetch(url, { headers: { "X-Emby-Token": token } });
      if (!res.ok) return null;
      const type = res.headers.get("content-type") ?? "";
      const ext = type.includes("png") ? ".png" : type.includes("webp") ? ".webp" : ".jpg";
      fs.mkdirSync(path.dirname(fileWithoutExt), { recursive: true });
      fs.writeFileSync(fileWithoutExt + ext, Buffer.from(await res.arrayBuffer()));
      return ext;
    },
  };
}

/** `tasks` exécutées par paquets de six, dans l'ordre. */
export async function pool(tasks, concurrency = CONCURRENCY) {
  const results = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}
