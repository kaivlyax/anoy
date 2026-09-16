import { useState } from "react";
import { LockIcon, SparklesIcon } from "./Icons";
import { useAuth } from "../context/AuthContext";

const EMOJI_PACKS_CONFIG = [
  {
    id: "pack_default",
    name: "Classic",
    isPro: false,
    emojis: ["👍", "❤️", "🔥", "😂", "🎉", "🚀"]
  },
  {
    id: "pack_neon_flair",
    name: "Neon Flare",
    isPro: true,
    emojis: ["⚡", "💎", "👾", "✨", "🛸", "🔮", "👑", "🌈"]
  },
  {
    id: "pack_cyber_glow",
    name: "Cyber Vibe",
    isPro: true,
    emojis: ["💻", "🧠", "🤖", "🧬", "🌌", "🛰️", "🧪", "⚡"]
  },
  {
    id: "pack_gold_vip",
    name: "Gold VIP",
    isPro: true,
    emojis: ["🏆", "💰", "🥂", "⚜️", "🌟", "🛡️"]
  }
];

export default function ReactionPicker({ onSelect, onClose, position = "top" }) {
  const { profile } = useAuth();
  const isPro = Boolean(profile?.isPro && (!profile?.proExpiresAt || new Date(profile?.proExpiresAt) > new Date()));
  const [activePack, setActivePack] = useState("pack_default");

  const currentPack = EMOJI_PACKS_CONFIG.find((p) => p.id === activePack) || EMOJI_PACKS_CONFIG[0];
  const isPackLocked = currentPack.isPro && !isPro && !(profile?.unlockedEmojiPacks || []).includes(currentPack.id);

  return (
    <div className={`reaction-picker-popover reaction-pos-${position}`}>
      {/* Pack Tabs */}
      <div className="reaction-picker-tabs">
        {EMOJI_PACKS_CONFIG.map((pack) => {
          const locked = pack.isPro && !isPro && !(profile?.unlockedEmojiPacks || []).includes(pack.id);
          return (
            <button
              key={pack.id}
              type="button"
              className={`reaction-pack-tab ${activePack === pack.id ? "active" : ""}`}
              onClick={() => setActivePack(pack.id)}
            >
              <span>{pack.name}</span>
              {pack.isPro && (
                <span className="pack-pro-tag">
                  {locked ? <LockIcon size={10} /> : <SparklesIcon size={10} />}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Emoji Grid */}
      <div className="reaction-picker-grid">
        {isPackLocked ? (
          <div className="reaction-locked-banner">
            <LockIcon size={16} />
            <span>Unlock with ANOY Pro</span>
          </div>
        ) : (
          currentPack.emojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="reaction-emoji-btn"
              onClick={() => {
                onSelect(emoji);
                if (onClose) onClose();
              }}
            >
              {emoji}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
