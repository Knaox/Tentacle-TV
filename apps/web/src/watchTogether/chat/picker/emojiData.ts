/**
 * Watch Together — données du sélecteur d'emojis (~460 réactions, 8 catégories).
 *
 * RÈGLE : un espace entre chaque emoji, découpe par `split(" ")` — JAMAIS de
 * segmentation par graphème : les séquences ZWJ/VS16 (❤️‍🔥, 🐻‍❄️, ✌️…) restent
 * intactes quel que soit le moteur JS. Chaque emoji doit tenir en ≤ 16 unités
 * UTF-16 (WT_REACTION_MAX_LENGTH côté serveur) : pas de séquences
 * multi-personnes à teinte de peau.
 */

export interface EmojiCategory {
  id: string;
  /** Clé i18n (namespace watchTogether). */
  labelKey: string;
  /** Emoji-icône du chip de navigation. */
  icon: string;
  emojis: string[];
}

const split = (s: string): string[] => s.split(" ").filter(Boolean);

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: "smileys",
    labelKey: "pickerCatSmileys",
    icon: "😀",
    emojis: split(
      "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🫡 🤐 🤨 😐 😑 😶 🫥 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 😵‍💫 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 🫤 😟 🙁 😮 😯 😲 😳 🥺 🥹 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️ 🤡 👻 👽 🤖 💩 😺 😹 😻",
    ),
  },
  {
    id: "gestures",
    labelKey: "pickerCatGestures",
    icon: "👍",
    emojis: split(
      "👍 👎 👊 ✊ 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✌️ 🤞 🫰 🤟 🤘 👌 🤌 🤏 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤙 💪 🖕 ✍️ 🫶 🫂 💅 🤳 👂 👃 👀 👁️ 👄 👅 💋 🧠 🦷 🦴",
    ),
  },
  {
    id: "hearts",
    labelKey: "pickerCatHearts",
    icon: "❤️",
    emojis: split(
      "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 ❤️‍🩹 💕 💞 💓 💗 💖 💘 💝 💟 ♥️ 💌 💍 💑 💏 💐 🌹 🥀 🌷 🌺 🌸 🌻 🌼 💒",
    ),
  },
  {
    id: "animals",
    labelKey: "pickerCatAnimals",
    icon: "🐙",
    emojis: split(
      "🐙 🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐽 🐸 🐵 🙈 🙉 🙊 🐒 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🪱 🐛 🦋 🐌 🐞 🐜 🪰 🦂 🐢 🐍 🦎 🦖 🦕 🦑 🦐 🦞 🦀 🐡 🐠 🐟 🐬 🐳 🐋 🦈 🐊",
    ),
  },
  {
    id: "food",
    labelKey: "pickerCatFood",
    icon: "🍿",
    emojis: split(
      "🍿 🥤 🧋 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🍾 ☕ 🍵 🧃 🧊 🍕 🍔 🍟 🌭 🍗 🍖 🥩 🥓 🌮 🌯 🥙 🧆 🥪 🍜 🍝 🍣 🍤 🍙 🍚 🍛 🍲 🥘 🥟 🍱 🍫 🍬 🍭 🍩 🍪 🎂 🍰 🧁 🥧 🍦 🍨 🍎 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍",
    ),
  },
  {
    id: "party",
    labelKey: "pickerCatParty",
    icon: "🎬",
    emojis: split(
      "🎬 🎥 📽️ 🎞️ 📺 🍿 🎟️ 🎭 🎪 🎨 🎉 🎊 🎈 🎁 🎀 🪅 🎆 🎇 🎃 🎄 🎤 🎧 🎼 🎵 🎶 🎹 🥁 🎷 🎺 🎸 🪕 🎻 🎲 🎯 🎳 🎮 🕹️ 🧩 ♟️ ⚽ 🏀 🏈 ⚾ 🎾 🏐 🎱 🏓 🏸 🥊 ⛳ 🏆 🥇 🥈 🥉 🏅",
    ),
  },
  {
    id: "objects",
    labelKey: "pickerCatObjects",
    icon: "💡",
    emojis: split(
      "💡 🔦 🕯️ 📱 💻 🖥️ ⌨️ 🖱️ 📷 📸 📹 📼 💿 📀 💾 📡 🔋 🔌 ⏰ ⌚ ⏳ ⌛ 📢 📣 🔔 🔕 🔑 🗝️ 🔒 🔓 🛋️ 🛏️ 🚪 🪑 🧸 🎩 👑 💎 💰 💵 💸 ✏️ 📌 🚗 🚕 🏎️ 🚓 🚑 🚒 ✈️ 🚀 🛸 ⛵",
    ),
  },
  {
    id: "symbols",
    labelKey: "pickerCatSymbols",
    icon: "✨",
    emojis: split(
      "✨ 💯 ✅ ❌ ⭕ ❗ ❓ ‼️ ⁉️ 💢 💥 💦 💨 🕳️ 💬 💭 💤 🔥 ⚡ ⭐ 🌟 💫 🌈 ☀️ 🌙 ⛅ ☁️ 🌧️ ⛈️ ❄️ ☃️ 🌊 ⚠️ 🔞 🆗 🆒 🆕 🆓 🔝 🔜 ▶️ ⏸️ ⏹️ ⏭️ ⏮️ 🔀 🔁 ➕ ➖ ✔️ ☑️ 🔴 🟠 🟡 🟢 🔵 🟣",
    ),
  },
];
