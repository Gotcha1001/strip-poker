"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PokerCard } from "./PokerCard";
import { RotateCcw } from "lucide-react";

// ─── 5 clothing pieces ────────────────────────────────────────────────────────
const CLOTHING_EMOJI = ["👟", "👟", "🧦", "🧦", "👖", "👔", "👙"];

function LivesBadge({ lives, max }: { lives: number; max: number }) {
  const pieces = CLOTHING_EMOJI.slice(0, max);
  return (
    <div className="flex gap-0.5">
      {pieces.map((p, i) => (
        <span key={i} style={{ opacity: i < lives ? 1 : 0.15, fontSize: "0.8rem", transition: "all 0.3s", transform: i < lives ? "scale(1)" : "scale(0.6)", display: "inline-block" }}>
          {p}
        </span>
      ))}
    </div>
  );
}

// ─── Quips ────────────────────────────────────────────────────────────────────
const LOSE_QUIPS = [
  "💀 Off comes a piece — hope you're not cold!",
  "😳 That's gotta sting. And chill.",
  "🔥 The stakes just got HOT.",
  "😂 One fewer layer of dignity...",
  "👀 Getting interesting in here!",
];
const WIN_QUIPS = [
  "🎉 Fully clothed and victorious!",
  "😎 Poker face AND a full wardrobe.",
  "🃏 Strip poker royalty right there.",
];
const TIE_QUIPS = [
  "🤝 A tie! Nobody loses a piece this round.",
  "😅 All square. Lucky escape!",
  "🤝 Dead heat — clothes stay on for now.",
];
const FOLD_WIN_QUIPS = [
  "🏆 Everyone else folded — no stripping required!",
  "😅 Bluff worked — nobody had to strip!",
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// ─── Props ────────────────────────────────────────────────────────────────────
interface Player {
  userId: string;
  name: string;
  isBot: boolean;
  lives: number;
}

interface Props {
  winnerName: string;
  winnerIds: string[];
  loserIds: string[];
  winningHand: string;
  losingHand: string;
  isWinner: boolean;
  isLoser: boolean;
  players: Player[];
  holeCardsJson: string;
  onNextHand: () => void;
  onLobby: () => void;
  handNumber: number;
  startingLives: number;
}

export function StripWinScreen({
  winnerName,
  winnerIds,
  loserIds,
  winningHand,
  losingHand,
  isWinner,
  isLoser,
  players,
  holeCardsJson,
  onNextHand,
  onLobby,
  handNumber,
  startingLives,
}: Props) {
  const holeCards = JSON.parse(holeCardsJson) as Record<string, string[]>;
  const isTie     = loserIds.length === 0 && winnerIds.length > 1;
  const isFoldWin = loserIds.length === 0 && winnerIds.length === 1;

  const loserNames = loserIds
    .map(id => players.find(p => p.userId === id)?.name ?? id)
    .join(" & ");

  const emoji = isTie ? "🤝" : isFoldWin ? "🏆" : isLoser ? "😳" : isWinner ? "🏆" : "😌";
  const title = isTie
    ? "It's a Tie!"
    : isFoldWin
      ? `${winnerName} wins — no strip!`
      : isLoser
        ? `${loserNames} ${loserIds.length > 1 ? "lose" : "loses"} a piece!`
        : `${winnerName} wins!`;

  const quip = isTie ? pick(TIE_QUIPS)
    : isFoldWin ? pick(FOLD_WIN_QUIPS)
    : isLoser ? pick(LOSE_QUIPS)
    : pick(WIN_QUIPS);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-950 px-4 py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
        className="w-full max-w-md text-center"
      >
        {/* Big emoji */}
        <motion.div className="text-7xl mb-4"
          animate={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 0.6, delay: 0.3 }}>
          {emoji}
        </motion.div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-black text-white mb-2">{title}</h1>

        {/* Winning / losing hand labels */}
        {!isTie && !isFoldWin && (
          <div className="flex justify-center gap-4 mb-1 flex-wrap">
            {winningHand && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-900/40 text-amber-300 border border-amber-600/30 font-semibold">
                🏆 {winningHand}
              </span>
            )}
            {losingHand && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-red-900/40 text-red-300 border border-red-600/30 font-semibold">
                💀 {losingHand}
              </span>
            )}
          </div>
        )}

        {/* Quip */}
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="text-white/55 text-sm italic mt-2 mb-2">
          {quip}
        </motion.p>

        <p className="text-white/25 text-xs mb-6">Hand #{handNumber}</p>

        {/* Cards reveal */}
        <div className="flex flex-wrap justify-center gap-3 mb-5">
          {players
            .filter(p => holeCards[p.userId])
            .map(p => {
              const win  = winnerIds.includes(p.userId);
              const lose = loserIds.includes(p.userId);
              return (
                <motion.div key={p.userId}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                  className="flex flex-col items-center gap-2">
                  <div className="px-2 py-0.5 rounded text-[10px] font-semibold"
                    style={{
                      background: lose ? "rgba(239,68,68,0.2)" : win ? "rgba(245,158,11,0.2)" : "rgba(0,0,0,0.3)",
                      color:      lose ? "#fca5a5"             : win ? "#fcd34d"              : "rgba(255,255,255,0.45)",
                      border: `1px solid ${lose ? "rgba(239,68,68,0.4)" : win ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.1)"}`,
                    }}>
                    {lose ? "💀 " : win ? "🏆 " : ""}{p.name}
                  </div>
                  <div className="flex gap-1">
                    {holeCards[p.userId].map((c, i) => <PokerCard key={i} card={c} size="sm" index={i} />)}
                  </div>
                </motion.div>
              );
            })}
        </div>

        {/* Standings */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="p-4 rounded-2xl border border-purple-800 bg-purple-950/40 mb-6 text-left">
          <div className="text-xs font-semibold uppercase tracking-wider text-purple-300 mb-3">
            👕 Clothing Standings
          </div>
          <div className="space-y-2">
            {[...players].sort((a, b) => b.lives - a.lives).map(p => {
              const win  = winnerIds.includes(p.userId);
              const lose = loserIds.includes(p.userId);
              return (
                <div key={p.userId} className="flex items-center justify-between text-sm">
                  <span className={lose ? "text-red-300 font-semibold" : win ? "text-amber-300 font-semibold" : "text-white/65"}>
                    {lose ? "💀 " : win ? "🏆 " : ""}
                    {p.name}
                    {p.lives === 0 && <span className="ml-2 text-[10px] text-red-400">ELIMINATED</span>}
                  </span>
                  <LivesBadge lives={p.lives} max={startingLives} />
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <Button className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-5 text-base" onClick={onNextHand}>
            <RotateCcw size={15} className="mr-2" /> Next Hand
          </Button>
          <Button variant="outline" className="border-purple-500 text-purple-300 hover:bg-purple-900/30 px-6 py-5 text-base" onClick={onLobby}>
            Lobby
          </Button>
        </div>
      </motion.div>
    </div>
  );
}