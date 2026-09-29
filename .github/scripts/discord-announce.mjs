#!/usr/bin/env node
// Annonce sur Discord les versions que les boutiques servent RÉELLEMENT :
// les notes EN dans #announcements, les notes FR dans #annonces.
//
//   LIVE='<JSON de store-live.mjs>' DISCORD_BOT_TOKEN=… \
//     node .github/scripts/discord-announce.mjs [--dry-run] [--config <fichier>]
//
// Lancé par store-watch.yml APRÈS le veilleur, dans un job à part qui ne voit
// que ce jeton — aucune clé de boutique — et ne peut rien écrire dans le dépôt.
// Salons et seuils : .github/discord-announce.json. Le modèle des messages
// (un par plateforme et par version, enrichi boutique après boutique) est
// dans lib/announce-model.mjs.
//
// Sans jeton : ne touche pas à Discord et sort en 0 (annonces désactivées).
// Avec : vérifie à CHAQUE passage que le bot peut encore écrire dans les deux
// salons — un droit retiré se voit tout de suite, pas le jour d'une sortie.
// Exit 1 si le jeton ou un droit manque, ou si une annonce due n'est pas partie ;
// une panne passagère de Discord sans rien à annoncer n'est qu'un avertissement.
import { readFileSync } from 'node:fs';
import {
  PRODUCTS, buildAnnouncement, mergeStores, parseAnnouncement, releaseNotes, storesServing, targetVersion,
} from './lib/announce-model.mjs';
import { DiscordError, createDiscordClient, effectivePermissions, missingPermissions } from './lib/discord.mjs';
import { isVersion } from './lib/versions.mjs';

const LANGS = ['en', 'fr'];
const argv = process.argv.slice(2);
const option = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const dryRun = argv.includes('--dry-run') || process.env.DRY_RUN === 'true';
const why = (e) => (e instanceof Error ? e.message : String(e));
const fail = (msg) => {
  console.log(`::error title=Annonces Discord::${msg}`);
  process.exit(1);
};

const config = JSON.parse(readFileSync(option('--config') ?? '.github/discord-announce.json', 'utf8'));
for (const lang of LANGS) {
  if (!/^\d{17,20}$/.test(String(config.channels?.[lang] ?? ''))) fail(`channels.${lang} invalide dans la configuration.`);
}
const floors = Object.fromEntries(Object.entries(config.floors ?? {}).filter(([, v]) => isVersion(v)));

let live;
try {
  live = JSON.parse(process.env.LIVE ?? '');
} catch {
  fail('LIVE absent ou illisible (JSON attendu de store-live.mjs).');
}
// Seules des versions de forme exacte entrent dans un message.
const serving = Object.fromEntries(Object.entries(live ?? {}).map(([k, v]) => [k, isVersion(v) ? v : null]));

const plan = [];
for (const [key, product] of Object.entries(PRODUCTS)) {
  const version = targetVersion(product, serving, floors);
  if (version) plan.push({ key, version, stores: storesServing(product, serving, version) });
}
console.log(
  plan.length === 0
    ? 'Rien de neuf au-dessus des seuils : aucune annonce.'
    : `À annoncer : ${plan.map((p) => `${p.key} ${p.version} (${p.stores.join(', ')})`).join(' · ')}`,
);

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.log('::notice title=Annonces Discord::DISCORD_BOT_TOKEN absent — annonces désactivées.');
  process.exit(0);
}

/** Notes markdown d'une version dans une langue, ou null si le bloc manque. */
const notesFor = (productKey, version, lang) =>
  releaseNotes(readFileSync(PRODUCTS[productKey].changelog, 'utf8'), productKey, version, lang);

// Un refus (jeton, droit, salon disparu) est une panne de configuration ; un
// 5xx ou un réseau muet passe tout seul — il ne rougit le run que si une
// annonce était due.
const transient = (e) => !(e instanceof DiscordError) || e.status === 429 || e.status >= 500;
let failures = 0;
const trouble = (msg, e) => {
  if (plan.length === 0 && transient(e)) {
    console.log(`::warning title=Annonces Discord::${msg} : ${why(e)}`);
  } else {
    failures++;
    console.log(`::error title=Annonces Discord::${msg} : ${why(e)}`);
  }
};

const discord = createDiscordClient(token);
let me;
try {
  me = await discord.me();
} catch (e) {
  trouble('jeton du bot refusé ou Discord injoignable', e);
  process.exit(failures ? 1 : 0);
}

const guilds = new Map();
/** Ce que le bot a le droit de faire dans un salon (rôles et dérogations lus une fois par serveur). */
async function botAccess(channel) {
  if (!guilds.has(channel.guild_id)) {
    const [roles, member] = await Promise.all([discord.roles(channel.guild_id), discord.member(channel.guild_id, me.id)]);
    guilds.set(channel.guild_id, { roles, memberRoleIds: member.roles ?? [] });
  }
  const { roles, memberRoleIds } = guilds.get(channel.guild_id);
  return effectivePermissions({
    guildId: channel.guild_id, roles, memberRoleIds, userId: me.id, overwrites: channel.permission_overwrites ?? [],
  });
}

for (const lang of LANGS) {
  const channelId = config.channels[lang];
  let channel;
  let mine = [];
  try {
    channel = await discord.channel(channelId);
    const access = await botAccess(channel);
    const missing = missingPermissions(access);
    if (missing.length > 0) {
      failures++;
      console.log(`::error title=Annonces Discord::#${channel.name} : le bot n'a pas ${missing.join(', ')}.`);
      continue;
    }
    console.log(`#${channel.name} : le bot peut annoncer (${access.admin ? 'administrateur' : 'sans administrateur'}).`);
    if (plan.length > 0) mine = (await discord.recentMessages(channelId)).filter((m) => m.author?.id === me.id);
  } catch (e) {
    trouble(`salon ${lang} (${channelId}) illisible`, e);
    continue;
  }

  for (const item of plan) {
    const existing = mine
      .map((message) => ({ message, parsed: parseAnnouncement(message) }))
      .find(({ parsed }) => parsed?.productKey === item.key && parsed.version === item.version);
    const stores = mergeStores(item.key, existing?.parsed.stores ?? [], item.stores);
    const label = `#${channel.name} · ${item.key} ${item.version}`;
    if (existing && stores.length === existing.parsed.stores.length) {
      console.log(`${label} : déjà annoncée (${stores.join(', ')}).`);
      continue;
    }

    const notesMd = notesFor(item.key, item.version, lang);
    if (!notesMd) console.log(`::warning title=Annonces Discord::${label} : pas de bloc de notes, message sans notes.`);
    const payload = buildAnnouncement({
      productKey: item.key,
      version: item.version,
      stores,
      lang,
      notesMd,
      timestamp: existing?.parsed.timestamp ?? new Date().toISOString(),
    });
    const action = existing ? `mise à jour → ${stores.join(', ')}` : `publication → ${stores.join(', ')}`;

    if (dryRun) {
      const embed = payload.embeds[0];
      console.log(`[à blanc] ${label} : ${action}`);
      console.log(`          « ${embed.title} », ${embed.description.length} caractères de notes, boutons : ${payload.components[0].components.map((b) => b.label).join(', ')}`);
      continue;
    }
    try {
      if (existing) {
        await discord.edit(channelId, existing.message.id, payload);
      } else {
        const posted = await discord.post(channelId, payload);
        // Salon d'annonces (type 5) : la publication atteint aussi les serveurs abonnés.
        if (channel.type === 5) {
          await discord.crosspost(channelId, posted.id).catch((e) =>
            console.log(`::warning title=Annonces Discord::${label} : publication vers les abonnés refusée (${why(e)}).`),
          );
        }
      }
      console.log(`${label} : ${action}.`);
    } catch (e) {
      failures++;
      console.log(`::error title=Annonces Discord::${label} : ${why(e)}`);
    }
  }
}
process.exit(failures ? 1 : 0);
