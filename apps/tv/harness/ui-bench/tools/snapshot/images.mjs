// Les images de l'instantané, aux tailles dont les vues TV auront besoin au
// plus grand (fond plein cadre en 1920, affiche agrandie au focus en 900 de
// haut), téléchargées une fois et servies ensuite par le relais.
import path from "node:path";
import { pool } from "./api.mjs";

const TITLE_IMAGES = [
  { type: "Primary", params: "maxHeight=900&quality=85" },
  { type: "Thumb", params: "maxWidth=960&quality=85" },
  { type: "Backdrop", params: "maxWidth=1920&quality=80" },
  { type: "Logo", params: "maxWidth=800&quality=90" },
];

function tagOf(item, type) {
  if (type === "Backdrop") return item.BackdropImageTags?.[0] ?? null;
  return item.ImageTags?.[type] ?? null;
}

function plan(item) {
  if (item.Type === "Person") return [{ type: "Primary", params: "maxHeight=600&quality=85" }];
  if (item.Type === "Episode") return [{ type: "Primary", params: "maxWidth=960&quality=85" }, { type: "Thumb", params: "maxWidth=960&quality=85" }];
  if (item.Type === "Season") return [{ type: "Primary", params: "maxHeight=600&quality=85" }];
  return TITLE_IMAGES;
}

/** Télécharge tout dans `dir/img/<id>/<Type>.<ext>` ; rend `{ id: { Type: chemin } }`. */
export async function downloadImages(api, items, userId, dir, log) {
  const jobs = [];
  const images = {};
  for (const item of items.values()) {
    for (const { type, params } of plan(item)) {
      const tag = tagOf(item, type);
      if (!tag) continue;
      jobs.push(async () => {
        const base = path.join(dir, "img", item.Id, type);
        const ext = await api.download(`/Items/${item.Id}/Images/${type}?${params}&tag=${encodeURIComponent(tag)}`, base);
        if (ext) (images[item.Id] ??= {})[type] = `img/${item.Id}/${type}${ext}`;
      });
    }
  }
  log(`${jobs.length} images`);
  let done = 0;
  await pool(jobs.map((job) => async () => {
    await job();
    done += 1;
    if (done % 50 === 0) log(`  ${done}/${jobs.length}`);
  }));
  const avatar = await api.download(`/Users/${userId}/Images/Primary?maxHeight=264&quality=90`, path.join(dir, "img", "profile", "Primary"));
  return { images, avatar: avatar ? `img/profile/Primary${avatar}` : null };
}
