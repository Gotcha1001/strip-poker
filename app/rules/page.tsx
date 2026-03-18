"use client";

import { motion, type Variants } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

// ─── Animation helpers ────────────────────────────────────────────────────────
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

// ─── Data ─────────────────────────────────────────────────────────────────────
const PHASES = [
  {
    step: "01",
    phase: "The Deal",
    icon: "🃏",
    color: "#7c3aed",
    glow: "rgba(124,58,237,0.35)",
    description:
      "Every player receives 5 cards dealt face-down. Nobody sees anyone else's hand. The player to the left of the dealer acts first.",
  },
  {
    step: "02",
    phase: "First Bet",
    icon: "💰",
    color: "#0891b2",
    glow: "rgba(8,145,178,0.35)",
    description:
      "Going around the table, each player chooses their action. No chips — betting here signals confidence in your hand.",
    actions: [
      { label: "✋ Check", desc: "Pass without betting. Only if nobody has bet yet." },
      { label: "💰 Bet", desc: "Open the betting. Everyone else must respond." },
      { label: "✅ Call", desc: "Match someone's bet and stay in." },
      { label: "😬 Fold", desc: "Throw in your hand. You're safe this round." },
    ],
  },
  {
    step: "03",
    phase: "The Draw",
    icon: "🔄",
    color: "#059669",
    glow: "rgba(5,150,105,0.35)",
    description:
      "Each player discards up to 3 cards and draws replacements from the deck. Tap the cards you want to swap — or keep all 5 and stand pat.",
    tips: [
      "Keep pairs, two pair, three of a kind — always.",
      "Discard single low cards to chase a better hand.",
      "Standing pat (keeping all 5) signals a strong hand — or a bluff.",
      "You can discard 0, 1, 2, or 3 cards. Max 3.",
    ],
  },
  {
    step: "04",
    phase: "Second Bet",
    icon: "🔥",
    color: "#d97706",
    glow: "rgba(217,119,6,0.35)",
    description:
      "Another betting round with the same options. Now you know what your improved hand looks like. Bet strong, bluff boldly, or fold and stay dressed.",
  },
  {
    step: "05",
    phase: "Showdown",
    icon: "👁️",
    color: "#dc2626",
    glow: "rgba(220,38,38,0.35)",
    description:
      "All remaining players reveal their hands. The player with the WORST hand loses one clothing piece. Ties? Nobody loses — lucky escape!",
  },
];

const HAND_RANKINGS = [
  { rank: "Royal Flush",     example: "A♠ K♠ Q♠ J♠ 10♠",  badge: "👑", tier: "best" },
  { rank: "Straight Flush",  example: "9♥ 8♥ 7♥ 6♥ 5♥",   badge: "⚡", tier: "great" },
  { rank: "Four of a Kind",  example: "Q♠ Q♥ Q♦ Q♣ 7♠",   badge: "🔥", tier: "great" },
  { rank: "Full House",      example: "K♠ K♥ K♦ 3♠ 3♥",   badge: "💪", tier: "good" },
  { rank: "Flush",           example: "A♣ J♣ 8♣ 5♣ 2♣",   badge: "✨", tier: "good" },
  { rank: "Straight",        example: "8♠ 7♥ 6♦ 5♣ 4♠",   badge: "📈", tier: "ok" },
  { rank: "Three of a Kind", example: "J♠ J♥ J♦ 9♣ 2♠",   badge: "🎯", tier: "ok" },
  { rank: "Two Pair",        example: "9♠ 9♥ 4♦ 4♣ K♠",   badge: "✌️", tier: "ok" },
  { rank: "Pair",            example: "6♠ 6♥ A♦ K♣ 2♠",   badge: "👆", tier: "danger" },
  { rank: "High Card",       example: "A♠ J♥ 8♦ 5♣ 2♠",   badge: "😬", tier: "danger" },
];

const QUICK_TIPS = [
  { icon: "🎭", tip: "Bluffing is legal and encouraged", detail: "Standing pat or betting big on a bad hand can scare others into folding." },
  { icon: "👀", tip: "Watch how many cards people draw", detail: "Drawing 3 cards usually means a weak hand. Standing pat? Probably strong — or a bluff." },
  { icon: "😏", tip: "Fold to save your clothes", detail: "There's no shame in folding early. Staying in with a bad hand always risks a piece." },
  { icon: "🤝", tip: "Ties save everyone", detail: "If two players share the worst hand equally, nobody loses a piece. Rare, but it happens!" },
  { icon: "🏆", tip: "Last one clothed wins", detail: "The winner is the final player with any clothing pieces remaining." },
  { icon: "🎲", tip: "Luck matters, skill matters more", detail: "Drawing well, betting smart, and reading your opponents separates winners from losers." },
];

const CLOTHING_PIECES = [
  { piece: "Right Shoe", icon: "👟" },
  { piece: "Left Shoe",  icon: "👟" },
  { piece: "Right Sock", icon: "🧦" },
  { piece: "Left Sock",  icon: "🧦" },
  { piece: "Pants",      icon: "👖" },
  { piece: "Shirt",      icon: "👔" },
  { piece: "Underwear",  icon: "👙" },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function RulesPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 pb-20">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <motion.div
        className="text-center pt-8 pb-12"
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        custom={0}
      >
        <motion.div
          className="text-7xl mb-4 inline-block"
          animate={{ rotate: [0, -8, 8, -4, 0] }}
          transition={{ duration: 2, delay: 0.8, repeat: Infinity, repeatDelay: 4 }}
        >
          🎰
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-black text-black dark:text-white tracking-tight mb-3">
          How to Play
        </h1>
        <p className="text-lg text-gray-500 dark:text-emerald-300 max-w-xl mx-auto">
          Classic 5-Card Draw Strip Poker — the same game played at parties worldwide for decades.
          Simple rules, big stakes.
        </p>

        {/* Quick-start CTA */}
        <motion.div className="mt-6 flex justify-center gap-3 flex-wrap" variants={fadeUp} custom={1}>
          <Link href="/local">
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-5 text-base shadow-lg">
              <Play className="h-4 w-4 mr-2" /> Play Locally
            </Button>
          </Link>
          <Link href="/lobby">
            <Button variant="outline" className="border-emerald-500 text-emerald-600 dark:text-emerald-400 px-8 py-5 text-base">
              Join Online Game
            </Button>
          </Link>
        </motion.div>
      </motion.div>

      {/* ── The Basics ───────────────────────────────────────────────────── */}
      <motion.section
        className="mb-14"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={fadeUp}
        custom={0}
      >
        <SectionLabel>The Basics</SectionLabel>
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          {[
            { icon: "👕", label: "5 pieces each", desc: "Shoes, socks, pants, shirt, underwear. Lose them one by one." },
            { icon: "🃏", label: "5-Card Draw", desc: "The classic. Get 5 cards, swap up to 3, bet twice, then showdown." },
            { icon: "💀", label: "Worst hand strips", desc: "Lowest hand at showdown loses one piece. Ties? Nobody strips." },
          ].map((item, i) => (
            <motion.div
              key={i}
              custom={i}
              variants={fadeUp}
              className="p-5 rounded-2xl border border-gray-200 dark:border-emerald-800 bg-white dark:bg-emerald-950/40 text-center shadow-sm"
            >
              <div className="text-4xl mb-2">{item.icon}</div>
              <div className="font-bold text-black dark:text-white text-sm mb-1">{item.label}</div>
              <div className="text-xs text-gray-500 dark:text-emerald-400">{item.desc}</div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── Clothing Pieces ──────────────────────────────────────────────── */}
      <motion.section
        className="mb-14"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={fadeUp}
        custom={0}
      >
        <SectionLabel>The 5 Clothing Pieces</SectionLabel>
        <p className="text-sm text-gray-500 dark:text-emerald-400 mt-1 mb-4">
          Each player starts fully clothed with 5 pieces. Lose them in order — last one dressed wins.
        </p>
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-emerald-800 bg-white dark:bg-emerald-950/40 p-6">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {CLOTHING_PIECES.slice(0, 5).map((item, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={fadeUp}
                className="flex flex-col items-center gap-1 flex-1 min-w-[48px]"
              >
                <motion.div
                  className="text-3xl"
                  whileHover={{ scale: 1.3, rotate: -10 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  {item.icon}
                </motion.div>
                <span className="text-[10px] text-gray-500 dark:text-emerald-400 text-center leading-tight">
                  {item.piece}
                </span>
                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center text-[10px] font-black text-emerald-700 dark:text-emerald-300">
                  {i + 1}
                </div>
              </motion.div>
            ))}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 opacity-60 rounded-b-2xl" />
        </div>
      </motion.section>

      {/* ── Phase-by-phase ───────────────────────────────────────────────── */}
      <motion.section
        className="mb-14"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={fadeUp}
        custom={0}
      >
        <SectionLabel>Hand by Hand</SectionLabel>
        <p className="text-sm text-gray-500 dark:text-emerald-400 mt-1 mb-6">
          Each hand follows the same 5 steps. Learn them once, play forever.
        </p>

        <div className="space-y-4">
          {PHASES.map((phase, i) => (
            <motion.div
              key={i}
              custom={i}
              variants={fadeUp}
              className="relative rounded-2xl border border-gray-200 dark:border-emerald-800 bg-white dark:bg-emerald-950/40 overflow-hidden shadow-sm"
            >
              {/* Left accent bar */}
              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: phase.color }} />

              <div className="pl-5 pr-5 py-5">
                <div className="flex items-start gap-4">
                  {/* Step number + icon */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-1">
                    <motion.div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg"
                      style={{ background: phase.glow, border: `1px solid ${phase.color}40` }}
                      whileHover={{ scale: 1.1 }}
                    >
                      {phase.icon}
                    </motion.div>
                    <span className="text-[10px] font-black text-gray-300 dark:text-emerald-700 tracking-widest">
                      {phase.step}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-black dark:text-white text-lg mb-1">{phase.phase}</h3>
                    <p className="text-sm text-gray-600 dark:text-emerald-300 leading-relaxed">{phase.description}</p>

                    {/* Action list */}
                    {phase.actions && (
                      <div className="grid sm:grid-cols-2 gap-2 mt-3">
                        {phase.actions.map((a, j) => (
                          <div key={j} className="flex items-start gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-emerald-900/30 border border-gray-100 dark:border-emerald-800">
                            <span className="font-bold text-xs text-black dark:text-white whitespace-nowrap">{a.label}</span>
                            <span className="text-[11px] text-gray-500 dark:text-emerald-400 leading-snug">{a.desc}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tips list */}
                    {phase.tips && (
                      <ul className="mt-3 space-y-1.5">
                        {phase.tips.map((tip, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-gray-600 dark:text-emerald-300">
                            <span className="text-emerald-500 mt-0.5 flex-shrink-0">▸</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── Hand Rankings ────────────────────────────────────────────────── */}
      <motion.section
        className="mb-14"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={fadeUp}
        custom={0}
      >
        <SectionLabel>Hand Rankings</SectionLabel>
        <p className="text-sm text-gray-500 dark:text-emerald-400 mt-1 mb-4">
          Highest to lowest. You want to be at the TOP — the player at the bottom loses a piece.
        </p>

        <div className="rounded-2xl border border-gray-200 dark:border-emerald-800 bg-white dark:bg-emerald-950/40 overflow-hidden shadow-sm">
          {HAND_RANKINGS.map((h, i) => {
            const tierStyles: Record<string, string> = {
              best:   "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
              great:  "bg-emerald-50 dark:bg-emerald-900/20",
              good:   "",
              ok:     "",
              danger: "bg-red-50 dark:bg-red-900/10",
            };
            const rankStyles: Record<string, string> = {
              best:   "text-amber-600 dark:text-amber-400",
              great:  "text-emerald-600 dark:text-emerald-400",
              good:   "text-black dark:text-white",
              ok:     "text-gray-700 dark:text-gray-300",
              danger: "text-red-500 dark:text-red-400",
            };
            return (
              <motion.div
                key={i}
                custom={i * 0.3}
                variants={fadeUp}
                className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-emerald-900/50 last:border-0 ${tierStyles[h.tier]}`}
              >
                <span className="text-base w-6 text-center">{h.badge}</span>
                <div className="flex-1 min-w-0">
                  <span className={`font-bold text-sm ${rankStyles[h.tier]}`}>{h.rank}</span>
                  <span className="text-[11px] text-gray-400 dark:text-emerald-600 ml-2 font-mono">{h.example}</span>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  h.tier === "best"   ? "bg-amber-200 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300" :
                  h.tier === "great"  ? "bg-emerald-200 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300" :
                  h.tier === "danger" ? "bg-red-200 dark:bg-red-900/40 text-red-600 dark:text-red-400" :
                  "bg-gray-100 dark:bg-emerald-900/40 text-gray-500 dark:text-emerald-500"
                }`}>
                  {i === 0 ? "Best" : i === 9 ? "Worst" : `#${i + 1}`}
                </span>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-3 p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 flex items-start gap-2">
          <span className="text-lg flex-shrink-0">⚠️</span>
          <p className="text-xs text-red-700 dark:text-red-400">
            <strong>Remember:</strong> In strip poker you want the BEST hand, not the worst. The player with the lowest-ranked hand at showdown loses a clothing piece.
          </p>
        </div>
      </motion.section>

      {/* ── Quick Tips ───────────────────────────────────────────────────── */}
      <motion.section
        className="mb-14"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={fadeUp}
        custom={0}
      >
        <SectionLabel>Pro Tips</SectionLabel>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          {QUICK_TIPS.map((tip, i) => (
            <motion.div
              key={i}
              custom={i}
              variants={fadeUp}
              className="flex items-start gap-3 p-4 rounded-2xl border border-gray-200 dark:border-emerald-800 bg-white dark:bg-emerald-950/40 shadow-sm"
            >
              <span className="text-2xl flex-shrink-0">{tip.icon}</span>
              <div>
                <div className="font-bold text-black dark:text-white text-sm mb-0.5">{tip.tip}</div>
                <div className="text-xs text-gray-500 dark:text-emerald-400 leading-relaxed">{tip.detail}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── Elimination & Winning ─────────────────────────────────────────── */}
      <motion.section
        className="mb-14"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={fadeUp}
        custom={0}
      >
        <SectionLabel>Elimination & Winning</SectionLabel>
        <div className="space-y-3 mt-4">
          {[
            {
              icon: "💀",
              title: "Losing all your pieces",
              text: "When a player reaches 0 clothing pieces they are eliminated from the game. They sit out all future hands.",
              bg: "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/50",
            },
            {
              icon: "🏆",
              title: "Winning the game",
              text: "The last player with any clothing pieces remaining wins the entire game. Could take many hands — or just a few lucky ones.",
              bg: "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/50",
            },
            {
              icon: "🤝",
              title: "Ties at showdown",
              text: "If two or more players share the exact lowest hand value, it is a complete tie — nobody loses a piece that round. The hand is simply replayed next turn.",
              bg: "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/50",
            },
            {
              icon: "😏",
              title: "Folding doesn't cost you",
              text: "Folding before showdown means you don't risk losing a piece — but you also can't win the hand. Use it strategically when your cards are hopeless.",
              bg: "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/50",
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              custom={i}
              variants={fadeUp}
              className={`flex items-start gap-3 p-4 rounded-2xl border ${item.bg}`}
            >
              <span className="text-2xl flex-shrink-0">{item.icon}</span>
              <div>
                <div className="font-bold text-black dark:text-white text-sm mb-0.5">{item.title}</div>
                <div className="text-xs text-gray-600 dark:text-emerald-400 leading-relaxed">{item.text}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── Online vs Local ──────────────────────────────────────────────── */}
      <motion.section
        className="mb-14"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={fadeUp}
        custom={0}
      >
        <SectionLabel>Game Modes</SectionLabel>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div className="p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-emerald-950/40 shadow-sm">
            <div className="text-3xl mb-2">🌍</div>
            <h3 className="font-black text-black dark:text-white mb-2">Online Multiplayer</h3>
            <p className="text-sm text-gray-500 dark:text-emerald-400 leading-relaxed mb-3">
              Play with friends or strangers over the internet. Create a private room and share the link, or join an open table in the lobby.
            </p>
            <Link href="/lobby">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white">Enter Lobby</Button>
            </Link>
          </div>
          <div className="p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-emerald-950/40 shadow-sm">
            <div className="text-3xl mb-2">🏠</div>
            <h3 className="font-black text-black dark:text-white mb-2">Pass-and-Play Local</h3>
            <p className="text-sm text-gray-500 dark:text-emerald-400 leading-relaxed mb-3">
              2–4 players sharing one device. Pass it around — a handoff screen hides your cards between turns. Perfect for in-person play.
            </p>
            <Link href="/local">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white">Play Locally</Button>
            </Link>
          </div>
        </div>
      </motion.section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <motion.div
        className="text-center py-10 px-6 rounded-3xl border border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/60 dark:to-teal-950/40"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeUp}
        custom={0}
      >
        <div className="text-5xl mb-3">🃏</div>
        <h2 className="text-2xl font-black text-black dark:text-white mb-2">Ready to Play?</h2>
        <p className="text-gray-500 dark:text-emerald-300 text-sm mb-5">
          You know the rules. Now go lose your shirt — or better yet, keep it.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <Link href="/local">
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-5 text-base shadow-lg">
              <Play className="h-4 w-4 mr-2" /> Play Now
            </Button>
          </Link>
          <Link href="/lobby">
            <Button variant="outline" className="border-emerald-500 text-emerald-600 dark:text-emerald-400 px-8 py-5 text-base">
              Browse Lobby
            </Button>
          </Link>
        </div>
      </motion.div>

    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-xl font-black text-black dark:text-white tracking-tight">{children}</h2>
      <div className="flex-1 h-px bg-gradient-to-r from-emerald-300 dark:from-emerald-700 to-transparent" />
    </div>
  );
}