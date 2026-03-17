"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import {
  BookOpen,
  ChevronRight,
  Star,
  Shield,
  Zap,
  Trophy,
  Info,
} from "lucide-react";

// ─── Tip images ───────────────────────────────────────────────────────────────
const TIPS = [
  {
    id: 1,
    src: "/tips/tip1.jpg",
    title: "Hand Rankings",
    caption:
      "Know which hands beat which — from High Card all the way up to Royal Flush.",
  },
  {
    id: 2,
    src: "/tips/tip2.jpg",
    title: "Position is Power",
    caption:
      "Acting last gives you more information. The dealer button is the most powerful seat.",
  },
  {
    id: 3,
    src: "/tips/tip3.jpg",
    title: "Reading the Board",
    caption:
      "Learn to spot flushes, straights, and pair boards to understand your risk.",
  },
  {
    id: 4,
    src: "/tips/tip4.jpg",
    title: "Bet Sizing",
    caption:
      "Size your bets with purpose. Too small invites calls; too large drives folds.",
  },
  {
    id: 5,
    src: "/tips/tip5.jpg",
    title: "Bluffing & Tells",
    caption:
      "Well-timed bluffs can win pots without the best hand — but pick your spots carefully.",
  },
];

// ─── Rules sections ───────────────────────────────────────────────────────────
const RULES = [
  {
    icon: BookOpen,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/20",
    title: "The Basics",
    items: [
      "Each player is dealt 2 private hole cards face down.",
      "5 community cards are dealt face up in three stages: Flop (3), Turn (1), River (1).",
      "Players make the best 5-card hand using any combination of their 2 hole cards and the 5 community cards.",
      "The player with the best hand at showdown wins the pot.",
    ],
  },
  {
    icon: Zap,
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/20",
    title: "Betting Rounds",
    items: [
      "Pre-Flop — After hole cards are dealt. Small blind and big blind post forced bets.",
      "Flop — After the first 3 community cards are revealed.",
      "Turn — After the 4th community card is revealed.",
      "River — After the 5th and final community card is revealed.",
      "On each street, players can Check, Bet, Call, Raise, or Fold.",
    ],
  },
  {
    icon: Trophy,
    color: "text-yellow-400",
    bg: "bg-yellow-400/10 border-yellow-400/20",
    title: "Hand Rankings (Best → Worst)",
    items: [
      "🏆 Royal Flush — A K Q J 10, all same suit",
      "✨ Straight Flush — Five consecutive cards, same suit",
      "4️⃣  Four of a Kind — Four cards of the same rank",
      "🏠 Full House — Three of a kind + a pair",
      "♠ Flush — Any five cards of the same suit",
      "➡️ Straight — Five consecutive cards, any suit",
      "3️⃣  Three of a Kind — Three cards of the same rank",
      "✌️ Two Pair — Two different pairs",
      "1️⃣  One Pair — Two cards of the same rank",
      "🃏 High Card — None of the above; highest card plays",
    ],
  },
  {
    icon: Shield,
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/20",
    title: "Key Rules",
    items: [
      "The dealer button moves clockwise after each hand.",
      "Small blind = half the big blind. Both are forced bets.",
      "In heads-up play, the dealer posts the small blind and acts first pre-flop.",
      "All-in players can only win the portion of the pot they contributed to.",
      "If two players tie, the pot is split equally (odd chip to first left of dealer).",
      "A player with no chips remaining is eliminated from the game.",
    ],
  },
  {
    icon: Star,
    color: "text-purple-400",
    bg: "bg-purple-400/10 border-purple-400/20",
    title: "Beginner Tips",
    items: [
      "Play tight early — only bet on strong starting hands like high pairs or A-K.",
      "Pay attention to position. Late position (near dealer) gives you a big advantage.",
      "Don't be afraid to fold. Saving chips is just as important as winning them.",
      "Watch your opponents. Betting patterns reveal a lot about their hand strength.",
      "Manage your bankroll. Never risk chips you can't afford to lose in one hand.",
    ],
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TipsPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-emerald-950 pb-16 overflow-x-hidden">
      {/* Animated blobs (dark mode) */}
      <div className="hidden dark:block fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <motion.div
          className="absolute top-[-200px] left-[-200px] w-[600px] h-[600px] rounded-full bg-emerald-900 opacity-30"
          animate={{ scale: [1, 1.2, 1], x: [0, 80, 0], y: [0, -60, 0] }}
          transition={{ duration: 28, repeat: Infinity, repeatType: "mirror" }}
        />
        <motion.div
          className="absolute bottom-[-300px] right-[-200px] w-[700px] h-[700px] rounded-full bg-teal-950 opacity-25"
          animate={{ scale: [1, 1.15, 1], x: [0, -60, 0], y: [0, 80, 0] }}
          transition={{ duration: 35, repeat: Infinity, repeatType: "mirror" }}
        />
      </div>

      <div className="relative z-10 max-w-9xl mx-auto px-4 sm:px-8 pt-10">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="mb-10"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-500/30">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-black dark:text-white">
              Tips &amp; Rules
            </h1>
          </div>
          <p className="text-gray-500 dark:text-emerald-300 text-sm sm:text-base max-w-xl">
            New to Texas Hold&apos;em? Start here. Visual guides, hand rankings,
            and everything you need to play with confidence.
          </p>
        </motion.div>

        {/* ── Visual Tip Cards — full-width stacked ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.55 }}
          className="mb-14"
        >
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-emerald-400 mb-5">
            Visual Guides
          </h2>

          <div className="flex flex-col gap-6">
            {TIPS.map((tip, i) => (
              <motion.div
                key={tip.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.1, duration: 0.55 }}
                className="group flex flex-col rounded-2xl overflow-hidden border border-gray-200 dark:border-emerald-800/60 bg-gray-50 dark:bg-emerald-950/50 shadow-sm hover:shadow-xl dark:hover:shadow-emerald-900/40 transition-all duration-300"
              >
                {/* Full-width image */}
                <div className="relative w-full aspect-video overflow-hidden bg-gray-100 dark:bg-emerald-900/40">
                  <Image
                    src={tip.src}
                    alt={tip.title}
                    fill
                    className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    sizes="(max-width: 1024px) 100vw, 1024px"
                  />
                  {/* Number badge */}
                  <div className="absolute top-3 left-3 w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center shadow-lg">
                    {tip.id}
                  </div>
                </div>

                {/* Caption */}
                <div className="px-5 py-4 flex flex-col gap-1">
                  <span className="text-base font-bold text-black dark:text-white">
                    {tip.title}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-emerald-300 leading-relaxed">
                    {tip.caption}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── Divider ── */}
        <div className="flex items-center gap-3 mb-10">
          <div className="flex-1 h-px bg-gray-200 dark:bg-emerald-800/50" />
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-emerald-500 flex items-center gap-1.5">
            <Info className="h-3 w-3" /> Rules &amp; Strategy
          </span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-emerald-800/50" />
        </div>

        {/* ── Rules Sections ── */}
        <div className="flex flex-col gap-5">
          {RULES.map((section, i) => {
            const Icon = section.icon;
            return (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.07, duration: 0.5 }}
                className={`rounded-2xl border p-5 ${section.bg}`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Icon className={`h-5 w-5 ${section.color}`} />
                  <h3 className="text-base font-bold text-black dark:text-white">
                    {section.title}
                  </h3>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {section.items.map((item, j) => (
                    <li
                      key={j}
                      className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-emerald-100"
                    >
                      <ChevronRight
                        className={`h-4 w-4 mt-0.5 flex-shrink-0 ${section.color}`}
                      />
                      <span className="leading-snug">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        {/* ── Footer note ── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-10 text-center text-xs text-gray-400 dark:text-emerald-600"
        >
          Ready to play? Head to the Lobby or challenge the Bot to practice your
          skills.
        </motion.p>
      </div>
    </main>
  );
}
