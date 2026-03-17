"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Play,
  Eye,
  EyeOff,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PokerCard } from "../components/PokerCard";
import { useBackground } from "../context/BackgroundContext";

// ─── Types ───────────────────────────────────────────────────────────────────
type GameStatus = "setup" | "handoff" | "playing" | "handResult" | "gameOver";
type PlayerState = "active" | "folded" | "allIn";
type Phase = "preflop" | "flop" | "turn" | "river" | "showdown";

interface LocalPlayer {
  id: number;
  name: string;
  chips: number;
  holeCards: string[];
  bet: number;
  state: PlayerState;
  status: string;
}

interface LocalGameState {
  players: LocalPlayer[];
  deck: string[];
  community: string[];
  pot: number;
  currentBet: number;
  minRaise: number;
  bigBlind: number;
  dealerIdx: number;
  currentPlayerIdx: number;
  phase: Phase;
  lastAction: string;
  handNumber: number;
  handResult: HandResult | null;
}

interface HandResult {
  winnerIds: number[];
  winningHand: string;
  pot: number;
  showdownCards: Record<number, string[]>;
}

// ─── Deck helpers ────────────────────────────────────────────────────────────
const SUITS = ["S", "H", "D", "C"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];

function createDeck(): string[] {
  const deck: string[] = [];
  for (const s of SUITS) for (const r of RANKS) deck.push(r + s);
  return shuffle(deck);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Hand Evaluation ─────────────────────────────────────────────────────────
function rankVal(r: string): number {
  return RANKS.indexOf(r);
}

function score5(cards: string[]): { value: number; name: string } {
  const ranks = cards.map((c) => rankVal(c.slice(0, -1))).sort((a, b) => b - a);
  const suits = cards.map((c) => c.slice(-1));
  const flush = suits.every((s) => s === suits[0]);
  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  const straight = unique.length === 5 && unique[0] - unique[4] === 4;
  const wheel = JSON.stringify(unique) === JSON.stringify([12, 3, 2, 1, 0]);
  const counts: Record<number, number> = {};
  ranks.forEach((r) => {
    counts[r] = (counts[r] || 0) + 1;
  });
  const groups = Object.entries(counts)
    .map(([r, c]) => ({ r: +r, c }))
    .sort((a, b) => b.c - a.c || b.r - a.r);

  if (flush && (straight || wheel)) {
    const top = wheel ? 3 : unique[0];
    return {
      value: top === 12 && !wheel ? 9_000_000 : 8_000_000 + top,
      name: top === 12 && !wheel ? "Royal Flush" : "Straight Flush",
    };
  }
  if (groups[0].c === 4)
    return {
      value: 7_000_000 + groups[0].r * 100 + groups[1].r,
      name: "Four of a Kind",
    };
  if (groups[0].c === 3 && groups[1].c === 2)
    return {
      value: 6_000_000 + groups[0].r * 100 + groups[1].r,
      name: "Full House",
    };
  if (flush)
    return {
      value:
        5_000_000 +
        ranks[0] * 10000 +
        ranks[1] * 1000 +
        ranks[2] * 100 +
        ranks[3] * 10 +
        ranks[4],
      name: "Flush",
    };
  if (straight || wheel)
    return { value: 4_000_000 + (wheel ? 3 : unique[0]), name: "Straight" };
  if (groups[0].c === 3)
    return {
      value: 3_000_000 + groups[0].r * 10000 + groups[1].r * 100 + groups[2].r,
      name: "Three of a Kind",
    };
  if (groups[0].c === 2 && groups[1].c === 2) {
    const h = Math.max(groups[0].r, groups[1].r),
      l = Math.min(groups[0].r, groups[1].r);
    return {
      value: 2_000_000 + h * 1000 + l * 10 + groups[2].r,
      name: "Two Pair",
    };
  }
  if (groups[0].c === 2)
    return {
      value:
        1_000_000 +
        groups[0].r * 10000 +
        groups[1].r * 1000 +
        groups[2].r * 100 +
        groups[3].r,
      name: "Pair",
    };
  return {
    value:
      ranks[0] * 10000 +
      ranks[1] * 1000 +
      ranks[2] * 100 +
      ranks[3] * 10 +
      ranks[4],
    name: "High Card",
  };
}

function evalBest(
  holeCards: string[],
  community: string[],
): { value: number; name: string } {
  const all = [...holeCards, ...community];
  if (all.length <= 5) return score5(all);
  let best = { value: -1, name: "" };
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const five = all.filter((_, k) => k !== i && k !== j);
      const s = score5(five);
      if (s.value > best.value) best = s;
    }
  }
  return best;
}

// ─── Showdown resolver ────────────────────────────────────────────────────────
function resolveShowdown(g: LocalGameState): LocalGameState {
  const activePlayers = g.players.filter((p) => p.state !== "folded");

  const evals = activePlayers.map((p) => ({
    player: p,
    result: evalBest(p.holeCards, g.community),
  }));

  const maxVal = Math.max(...evals.map((e) => e.result.value));
  const winners = evals.filter((e) => e.result.value === maxVal);
  const winnerIds = winners.map((w) => w.player.id);

  const share = Math.floor(g.pot / winners.length);
  const remainder = g.pot - share * winners.length;

  const updatedPlayers = g.players.map((p) => {
    const winnerEntry = winners.find((w) => w.player.id === p.id);
    if (!winnerEntry) return p;
    const bonus = p.id === winners[0].player.id ? remainder : 0;
    return { ...p, chips: p.chips + share + bonus };
  });

  const winningHand = winners[0].result.name;
  const showdownCards: Record<number, string[]> = {};
  activePlayers.forEach((p) => {
    showdownCards[p.id] = p.holeCards;
  });

  return {
    ...g,
    players: updatedPlayers,
    phase: "showdown",
    handResult: {
      winnerIds,
      winningHand,
      pot: g.pot,
      showdownCards,
    },
  };
}

// ─── Betting helpers ──────────────────────────────────────────────────────────
function getNextActiveIdx(players: LocalPlayer[], current: number): number {
  const n = players.length;
  let next = (current + 1) % n;
  let tries = 0;
  while (
    (players[next].state === "folded" || players[next].state === "allIn") &&
    tries < n
  ) {
    next = (next + 1) % n;
    tries++;
  }
  return next;
}

function advanceAfterAction(
  g: LocalGameState,
  lastRaiserId: number | null,
): LocalGameState {
  const notFolded = g.players.filter((p) => p.state !== "folded");
  if (notFolded.length === 1) {
    const winner = notFolded[0];
    const updatedPlayers = g.players.map((p) =>
      p.id === winner.id ? { ...p, chips: p.chips + g.pot } : p,
    );
    return {
      ...g,
      players: updatedPlayers,
      phase: "showdown",
      handResult: {
        winnerIds: [winner.id],
        winningHand: "Last player standing",
        pot: g.pot,
        showdownCards: {},
      },
    };
  }

  const active = g.players.filter((p) => p.state === "active");
  const allMatched = active.every((p) => p.bet >= g.currentBet);

  if (allMatched) {
    return advancePhase(g);
  }

  const nextIdx = getNextActiveIdx(g.players, g.currentPlayerIdx);
  return { ...g, currentPlayerIdx: nextIdx };
}

function advancePhase(g: LocalGameState): LocalGameState {
  const players = g.players.map((p) => ({ ...p, bet: 0 }));
  const deck = [...g.deck];
  let community = [...g.community];
  let phase = g.phase;

  if (g.phase === "preflop") {
    community = [...community, deck.pop()!, deck.pop()!, deck.pop()!];
    phase = "flop";
  } else if (g.phase === "flop") {
    community = [...community, deck.pop()!];
    phase = "turn";
  } else if (g.phase === "turn") {
    community = [...community, deck.pop()!];
    phase = "river";
  } else if (g.phase === "river") {
    return resolveShowdown({ ...g, players });
  } else {
    return g;
  }

  const n = players.length;
  let first = (g.dealerIdx + 1) % n;
  let tries = 0;
  while (
    (players[first].state === "folded" || players[first].state === "allIn") &&
    tries < n
  ) {
    first = (first + 1) % n;
    tries++;
  }

  const canAct = players.filter((p) => p.state === "active");
  if (canAct.length <= 1) {
    const next: LocalGameState = {
      ...g,
      players,
      deck,
      community,
      phase: phase as Phase,
      currentBet: 0,
      minRaise: g.bigBlind,
      currentPlayerIdx: first,
      lastAction: `${phase.charAt(0).toUpperCase() + phase.slice(1)} dealt`,
    };
    return advancePhase(next);
  }

  return {
    ...g,
    players,
    deck,
    community,
    phase: phase as Phase,
    currentBet: 0,
    minRaise: g.bigBlind,
    currentPlayerIdx: first,
    lastAction: `${phase.charAt(0).toUpperCase() + phase.slice(1)} dealt`,
  };
}

// ─── Background Layer ─────────────────────────────────────────────────────────
// Reusable background layer that mirrors Gameboard.tsx exactly.
// When src is empty (e.g. the default "felt" option), falls back to fallbackCss.
function BackgroundLayer({ fallbackCss }: { fallbackCss: string }) {
  const { selected: selectedBg } = useBackground();
  const hasImage = Boolean(selectedBg.src);

  return (
    <>
      {/* Base CSS background — shown when no image is selected */}
      {!hasImage && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: fallbackCss, zIndex: 0 }}
        />
      )}
      {/* Background image layer */}
      {hasImage && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${selectedBg.src})`,
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            zIndex: 0,
          }}
        />
      )}
      {/* Overlay tint */}
      {selectedBg.overlay && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: selectedBg.overlay, zIndex: 1 }}
        />
      )}
    </>
  );
}

// ─── Setup Screen ─────────────────────────────────────────────────────────────
function SetupScreen({
  onStart,
}: {
  onStart: (names: string[], chips: number, bb: number) => void;
}) {
  const [count, setCount] = useState(2);
  const [names, setNames] = useState([
    "Player 1",
    "Player 2",
    "Player 3",
    "Player 4",
  ]);
  const [chips, setChips] = useState(1000);
  const [bb, setBb] = useState(20);

  const DEMO = [
    { suit: "♠", rank: "A", color: "#1f2937" },
    { suit: "♥", rank: "K", color: "#c0392b" },
    { suit: "♦", rank: "Q", color: "#c0392b" },
    { suit: "♣", rank: "J", color: "#1f2937" },
    { suit: "♠", rank: "10", color: "#1f2937" },
  ];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center overflow-hidden bg-white dark:bg-emerald-950 py-12">
      <div className="hidden dark:block absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-[-250px] left-[-250px] w-[700px] h-[700px] rounded-full bg-emerald-900 opacity-40"
          animate={{ scale: [1, 1.3, 1], x: [0, 120, 0], y: [0, -80, 0] }}
          transition={{ duration: 25, repeat: Infinity, repeatType: "mirror" }}
        />
        <motion.div
          className="absolute bottom-[-300px] right-[-300px] w-[800px] h-[800px] rounded-full bg-teal-950 opacity-30"
          animate={{ scale: [1, 1.25, 1], x: [0, -100, 0], y: [0, 100, 0] }}
          transition={{ duration: 30, repeat: Infinity, repeatType: "mirror" }}
        />
      </div>

      {/* Demo cards */}
      <div className="relative h-40 w-full max-w-sm mb-8">
        {DEMO.map((card, i) => (
          <motion.div
            key={i}
            className="absolute w-14 h-20 rounded-2xl shadow-xl border-2 border-white flex items-center justify-center bg-white"
            style={{
              left: "50%",
              top: "50%",
              marginLeft: (i - 2) * 55 - 28,
              marginTop: -40,
              rotate: (i - 2) * 8,
              zIndex: i,
            }}
            animate={{ y: [0, -10, 0] }}
            transition={{
              duration: 3,
              delay: i * 0.4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <div style={{ color: card.color }} className="text-center">
              <div className="font-black text-lg leading-none">{card.rank}</div>
              <div className="text-xl">{card.suit}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 mb-8"
      >
        <h1 className="text-4xl md:text-5xl font-bold text-black dark:text-white tracking-tight">
          ♠ Play Locally
        </h1>
        <p className="mt-2 text-gray-500 dark:text-emerald-300">
          Pass-and-play Texas Hold&apos;em — up to 4 players on one screen
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="w-full max-w-md p-6 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-emerald-950/40 shadow-xl relative z-10"
      >
        <div className="mb-5">
          <label className="block text-sm font-semibold text-gray-700 dark:text-emerald-200 mb-3">
            <Users className="inline h-4 w-4 mr-1" /> Number of Players
          </label>
          <div className="flex gap-2">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all ${
                  count === n
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-gray-100 dark:bg-emerald-900/30 text-gray-600 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 mb-5">
          <label className="block text-sm font-semibold text-gray-700 dark:text-emerald-200 mb-1">
            Player Names
          </label>
          {Array.from({ length: count }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {i + 1}
                </div>
                <input
                  type="text"
                  value={names[i]}
                  onChange={(e) => {
                    const n = [...names];
                    n[i] = e.target.value;
                    setNames(n);
                  }}
                  placeholder={`Player ${i + 1}`}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none bg-gray-50 dark:bg-emerald-900/30 border border-gray-200 dark:border-emerald-700 text-black dark:text-white placeholder:text-gray-400"
                />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-emerald-400 mb-1">
              Starting chips
            </label>
            <input
              type="number"
              value={chips}
              onChange={(e) => setChips(+e.target.value)}
              step={100}
              min={100}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none bg-gray-50 dark:bg-emerald-900/30 border border-gray-200 dark:border-emerald-700 text-black dark:text-white text-center"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-emerald-400 mb-1">
              Big blind
            </label>
            <input
              type="number"
              value={bb}
              onChange={(e) => setBb(+e.target.value)}
              step={2}
              min={2}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none bg-gray-50 dark:bg-emerald-900/30 border border-gray-200 dark:border-emerald-700 text-black dark:text-white text-center"
            />
          </div>
        </div>

        <Button
          className="w-full py-6 text-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg"
          onClick={() => onStart(names.slice(0, count), chips, bb)}
        >
          <Play className="h-5 w-5 mr-2" /> Deal Cards
        </Button>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-6 text-sm text-gray-400 dark:text-emerald-500 max-w-sm relative z-10"
      >
        Each player sees their own cards privately. Pass the device after each
        action.
      </motion.p>
    </main>
  );
}

// ─── Handoff Screen ───────────────────────────────────────────────────────────
function HandoffScreen({
  player,
  onReveal,
}: {
  player: LocalPlayer;
  onReveal: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">
      {/* Dynamic background from context */}
      <BackgroundLayer fallbackCss="radial-gradient(ellipse at 50% 40%, #1a0a3e 0%, #0d0621 50%, #050312 100%)" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-sm w-full relative z-10"
      >
        <motion.div
          className="w-24 h-24 rounded-3xl bg-emerald-700 flex items-center justify-center mx-auto mb-4 shadow-2xl"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <EyeOff className="h-10 w-10 text-white" />
        </motion.div>

        <h2 className="text-3xl font-black text-white mb-2">Hand Off!</h2>
        <p className="text-emerald-300">Pass the device to</p>
        <p className="text-3xl font-black text-white mt-1 px-4 break-words">
          {player.name}
        </p>
        <p className="text-emerald-300 mt-2 text-sm">({player.chips} chips)</p>

        <div className="flex justify-center gap-2 my-8">
          {[0, 1].map((i) => (
            <div key={i} style={{ transform: `rotate(${(i - 0.5) * 8}deg)` }}>
              <PokerCard faceDown size="lg" index={i} />
            </div>
          ))}
        </div>

        <p className="text-emerald-400 text-sm mb-6">
          Make sure nobody else is looking before revealing your cards!
        </p>
        <Button
          className="w-full py-5 text-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg"
          onClick={onReveal}
        >
          <Eye className="h-5 w-5 mr-2" /> Reveal My Cards
        </Button>
      </motion.div>
    </div>
  );
}

// ─── Game Screen ──────────────────────────────────────────────────────────────
function GameScreen({
  gs,
  onAction,
}: {
  gs: LocalGameState;
  onAction: (
    action: "fold" | "check" | "call" | "raise" | "allIn",
    amount?: number,
  ) => void;
}) {
  const p = gs.players[gs.currentPlayerIdx];
  const myBet = p.bet;
  const callAmt = Math.min(gs.currentBet - myBet, p.chips);
  const canCheck = callAmt <= 0;
  const minRaiseTotal = gs.currentBet + gs.minRaise;
  const maxRaiseTotal = p.chips + p.bet;
  const [raiseAmt, setRaiseAmt] = useState(
    Math.min(minRaiseTotal, maxRaiseTotal),
  );
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [muted, setMuted] = useState(false);

  const n = gs.players.length;
  const sbIdx = (gs.dealerIdx + 1) % n;
  const bbIdx = (gs.dealerIdx + 2) % n;

  const PHASE_LABELS: Record<Phase, string> = {
    preflop: "Pre-Flop",
    flop: "Flop",
    turn: "Turn",
    river: "River",
    showdown: "Showdown",
  };

  const opponents = gs.players.filter((_, i) => i !== gs.currentPlayerIdx);

  return (
    <div className="min-h-screen flex flex-col overflow-hidden relative">
      {/* Dynamic background from context */}
      <BackgroundLayer fallbackCss="radial-gradient(ellipse at 50% 40%, #1a4a2e 0%, #0f2d1c 45%, #091a10 100%)" />

      {/* Felt texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
          zIndex: 3,
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/20 backdrop-blur-sm gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/20 bg-black/30 text-amber-400 font-bold text-sm">
          Pot: {gs.pot}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/40 uppercase tracking-widest">
            Hand #{gs.handNumber}
          </span>
          <div
            className="px-3 py-1 rounded-full text-xs font-bold border border-white/15 text-white/70"
            style={{
              background:
                gs.phase === "preflop"
                  ? "rgba(124,58,237,0.25)"
                  : gs.phase === "flop"
                    ? "rgba(16,185,129,0.2)"
                    : gs.phase === "turn"
                      ? "rgba(245,158,11,0.2)"
                      : "rgba(239,68,68,0.2)",
            }}
          >
            {PHASE_LABELS[gs.phase]}
          </div>
        </div>
        <button
          onClick={() => setMuted(!muted)}
          className="p-1.5 rounded-xl border border-white/20 text-white/60 hover:text-white hover:bg-white/10 transition-all"
        >
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
      </header>

      <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
        {/* Opponents */}
        <div className="flex justify-center gap-3 pt-4 pb-2 px-4 flex-wrap">
          {opponents.map((opp) => {
            const realIdx = gs.players.findIndex((pp) => pp.id === opp.id);
            const isDealer = realIdx === gs.dealerIdx;
            const isSB = realIdx === sbIdx;
            const isBB = realIdx === bbIdx;
            return (
              <motion.div
                key={opp.id}
                className="flex flex-col items-center gap-2"
              >
                <div
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border backdrop-blur-sm text-white"
                  style={{
                    background: "rgba(0,0,0,0.3)",
                    borderColor: "rgba(255,255,255,0.15)",
                  }}
                >
                  {opp.name}
                  {isDealer && (
                    <span className="w-4 h-4 rounded-full bg-amber-400 text-black text-[7px] font-black flex items-center justify-center">
                      D
                    </span>
                  )}
                  {isSB && (
                    <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[6px] font-black flex items-center justify-center">
                      SB
                    </span>
                  )}
                  {isBB && (
                    <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[6px] font-black flex items-center justify-center">
                      BB
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 rounded-full bg-white/20 font-bold text-[10px]">
                    {opp.chips}
                  </span>
                  {opp.state === "folded" && (
                    <span className="text-[9px] text-gray-400">FOLD</span>
                  )}
                  {opp.state === "allIn" && (
                    <span className="text-[9px] text-red-300 font-bold">
                      ALL IN
                    </span>
                  )}
                </div>
                <div
                  className="flex items-end gap-1"
                  style={{ height: "3.4rem" }}
                >
                  {[0, 1].map((j) => (
                    <div
                      key={j}
                      style={{
                        transform: `rotate(${(j - 0.5) * 6}deg)`,
                        marginLeft: j > 0 ? "-6px" : 0,
                      }}
                    >
                      <PokerCard faceDown size="sm" index={j} />
                    </div>
                  ))}
                </div>
                {opp.bet > 0 && (
                  <div className="text-[10px] text-green-300 font-semibold">
                    Bet: {opp.bet}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Community Cards */}
        <div className="flex flex-col items-center gap-2 py-3">
          <span className="text-[10px] text-white/35 uppercase tracking-widest">
            Community Cards
          </span>
          <div className="flex gap-2 flex-wrap justify-center">
            {Array.from({ length: 5 }).map((_, i) => (
              <PokerCard
                key={i}
                card={gs.community[i]}
                faceDown={!gs.community[i]}
                size="lg"
                index={i}
                className={!gs.community[i] ? "opacity-25" : ""}
              />
            ))}
          </div>
        </div>

        {/* Action log */}
        <AnimatePresence mode="wait">
          <motion.div
            key={gs.lastAction}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="text-xs text-center px-4 py-2 mx-4 rounded-xl border border-white/10 bg-black/25 backdrop-blur-sm text-white/55 truncate"
          >
            {gs.lastAction}
          </motion.div>
        </AnimatePresence>

        <div className="flex-1" />

        {/* Player hand panel */}
        <div
          className="relative border-t border-white/10 bg-black/40 backdrop-blur-md px-4 pt-3 pb-4"
          style={{ boxShadow: "0 -8px 32px rgba(0,0,0,0.5)" }}
        >
          {/* Turn indicator */}
          <motion.div
            className="flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-bold mb-2 justify-center"
            style={{
              background: "rgba(16,185,129,0.2)",
              borderColor: "#34d399",
              color: "#a7f3d0",
              boxShadow: "0 0 20px rgba(16,185,129,0.3)",
            }}
          >
            <motion.span
              animate={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
            >
              🎯
            </motion.span>
            {p.name}&apos;s turn!
          </motion.div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">
              {p.name}&apos;s Hand ({p.chips} chips)
            </span>
            {p.bet > 0 && (
              <span className="text-xs text-green-300">
                Bet this round: {p.bet}
              </span>
            )}
          </div>

          {/* Hole cards */}
          <div className="flex justify-center gap-4 mb-3">
            {p.holeCards.map((c, i) => (
              <PokerCard key={i} card={c} size="xl" index={i} />
            ))}
          </div>

          {/* Best hand indicator */}
          {gs.community.length >= 3 && (
            <div className="text-center mb-3">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-900/40 text-amber-300 border border-amber-600/30">
                {evalBest(p.holeCards, gs.community).name}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 justify-center flex-wrap">
              <button
                onClick={() => onAction("fold")}
                className="px-4 py-2.5 rounded-xl bg-red-900/60 border border-red-500/40 text-red-200 text-sm font-semibold hover:bg-red-900/80 active:scale-95 transition-all"
              >
                Fold
              </button>
              {canCheck ? (
                <button
                  onClick={() => onAction("check")}
                  className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/25 text-white text-sm font-semibold hover:bg-white/20 active:scale-95 transition-all"
                >
                  Check
                </button>
              ) : (
                <button
                  onClick={() => onAction("call")}
                  className="px-4 py-2.5 rounded-xl bg-emerald-900/60 border border-emerald-500/40 text-emerald-200 text-sm font-semibold hover:bg-emerald-900/80 active:scale-95 transition-all"
                >
                  Call {callAmt}
                </button>
              )}
              {p.chips > callAmt ? (
                <button
                  onClick={() => setRaiseOpen((v) => !v)}
                  className="px-4 py-2.5 rounded-xl bg-purple-900/60 border border-purple-500/40 text-purple-200 text-sm font-semibold hover:bg-purple-900/80 active:scale-95 transition-all"
                >
                  Raise
                </button>
              ) : (
                p.chips > 0 && (
                  <button
                    onClick={() => onAction("allIn")}
                    className="px-4 py-2.5 rounded-xl bg-amber-900/60 border border-amber-500/40 text-amber-200 text-sm font-semibold hover:bg-amber-900/80 active:scale-95 transition-all"
                  >
                    All In {p.chips}
                  </button>
                )
              )}
            </div>

            <AnimatePresence>
              {raiseOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex items-center gap-2 justify-center overflow-hidden flex-wrap"
                >
                  <input
                    type="range"
                    min={minRaiseTotal}
                    max={maxRaiseTotal}
                    step={gs.bigBlind}
                    value={raiseAmt}
                    onChange={(e) => setRaiseAmt(+e.target.value)}
                    className="flex-1 max-w-[120px] accent-emerald-500"
                  />
                  <span className="text-white font-bold text-sm min-w-[40px]">
                    {raiseAmt}
                  </span>
                  <button
                    onClick={() => {
                      onAction("raise", raiseAmt);
                      setRaiseOpen(false);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 active:scale-95 transition-all"
                  >
                    Raise to {raiseAmt}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hand Result Screen ───────────────────────────────────────────────────────
function HandResultScreen({
  gs,
  onContinue,
}: {
  gs: LocalGameState;
  onContinue: () => void;
}) {
  const result = gs.handResult!;
  const winners = gs.players.filter((p) => result.winnerIds.includes(p.id));
  const isSplit = winners.length > 1;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-950 px-4 py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
        className="w-full max-w-md text-center"
      >
        <motion.div
          className="text-6xl mb-4"
          animate={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          {isSplit ? "🤝" : "🏆"}
        </motion.div>

        <h1 className="text-3xl font-black text-white mb-1">
          {isSplit ? "Split Pot!" : `${winners[0].name} Wins!`}
        </h1>
        <p className="text-emerald-300 mb-1">
          <span className="text-amber-300 font-semibold">
            {result.winningHand}
          </span>
          <span className="text-white/50"> — Pot of {result.pot}</span>
        </p>
        <p className="text-white/40 text-sm mb-5">Hand #{gs.handNumber}</p>

        {/* Cards reveal */}
        <div className="flex flex-wrap justify-center gap-4 mb-5">
          {gs.players
            .filter((p) => p.state !== "folded")
            .map((p) => (
              <div key={p.id} className="flex flex-col items-center gap-2">
                <div
                  className="px-2 py-0.5 rounded text-[10px] font-semibold"
                  style={{
                    background: result.winnerIds.includes(p.id)
                      ? "rgba(245,158,11,0.25)"
                      : "rgba(0,0,0,0.3)",
                    color: result.winnerIds.includes(p.id)
                      ? "#fcd34d"
                      : "rgba(255,255,255,0.5)",
                    border: `1px solid ${result.winnerIds.includes(p.id) ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.1)"}`,
                  }}
                >
                  {result.winnerIds.includes(p.id) ? "🏆 " : ""}
                  {p.name}
                </div>
                <div className="flex gap-1">
                  {p.holeCards.map((c, i) => (
                    <PokerCard key={i} card={c} size="md" index={i} />
                  ))}
                </div>
              </div>
            ))}
        </div>

        {/* Board */}
        {gs.community.length > 0 && (
          <div className="flex flex-col items-center gap-2 mb-5">
            <span className="text-[10px] text-white/35 uppercase tracking-widest">
              Board
            </span>
            <div className="flex gap-2 flex-wrap justify-center">
              {gs.community.map((c, i) => (
                <PokerCard key={i} card={c} size="sm" index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Standings */}
        <div className="p-4 rounded-2xl border border-emerald-800 bg-emerald-950/40 mb-5 text-left">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300 mb-2">
            Chip Standings
          </div>
          <div className="space-y-2">
            {[...gs.players]
              .sort((a, b) => b.chips - a.chips)
              .map((p) => (
                <div key={p.id} className="flex justify-between text-sm">
                  <span
                    className={
                      result.winnerIds.includes(p.id)
                        ? "text-amber-300 font-semibold"
                        : "text-white/70"
                    }
                  >
                    {result.winnerIds.includes(p.id) ? "🏆 " : ""}
                    {p.name}
                    {p.chips <= 0 && (
                      <span className="ml-2 text-[10px] text-red-400">
                        BUST
                      </span>
                    )}
                  </span>
                  <span
                    className={
                      result.winnerIds.includes(p.id)
                        ? "text-amber-300 font-bold"
                        : "text-white/60"
                    }
                  >
                    {p.chips}
                  </span>
                </div>
              ))}
          </div>
        </div>

        <Button
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-5 text-base"
          onClick={onContinue}
        >
          <RotateCcw size={15} className="mr-2" /> Next Hand
        </Button>
      </motion.div>
    </div>
  );
}

// ─── Game Over Screen ─────────────────────────────────────────────────────────
function GameOverScreen({
  winner,
  allPlayers,
  onRestart,
}: {
  winner: LocalPlayer;
  allPlayers: LocalPlayer[];
  onRestart: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-950 px-4 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
      >
        <div className="text-7xl mb-4">🎰</div>
        <h1 className="text-3xl md:text-4xl font-black text-white mb-2">
          {winner.name} Wins the Game!
        </h1>
        <p className="text-emerald-300 mb-6">
          All other players have been eliminated
        </p>
        <div className="p-4 rounded-2xl border border-emerald-800 bg-emerald-950/40 mb-6 text-left max-w-xs mx-auto">
          {[...allPlayers]
            .sort((a, b) => b.chips - a.chips)
            .map((p) => (
              <div
                key={p.id}
                className="flex justify-between text-sm py-1 border-b border-white/5 last:border-0"
              >
                <span
                  className={
                    p.id === winner.id
                      ? "text-amber-300 font-semibold"
                      : "text-white/60"
                  }
                >
                  {p.id === winner.id ? "🏆 " : ""}
                  {p.name}
                </span>
                <span
                  className={
                    p.id === winner.id
                      ? "text-amber-300 font-bold"
                      : "text-white/40"
                  }
                >
                  {p.chips}
                </span>
              </div>
            ))}
        </div>
        <Button
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-5 text-base"
          onClick={onRestart}
        >
          New Game
        </Button>
      </motion.div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LocalPlayPage() {
  const [status, setStatus] = useState<GameStatus>("setup");
  const [gs, setGs] = useState<LocalGameState | null>(null);
  const [showHand, setShowHand] = useState(false);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Deal hand ──────────────────────────────────────
  function dealHand(
    allPlayers: LocalPlayer[],
    dealerIdx: number,
    handNum: number,
    bb: number,
  ): LocalGameState {
    const active = allPlayers.filter((p) => p.chips > 0);
    const deck = createDeck();
    const players: LocalPlayer[] = active.map((p) => ({
      ...p,
      holeCards: [deck.pop()!, deck.pop()!],
      bet: 0,
      state: "active",
      status: "",
    }));

    const n = players.length;
    const sbIdx = (dealerIdx + 1) % n;
    const bbIdx = (dealerIdx + 2) % n;
    const sbAmt = Math.min(Math.floor(bb / 2), players[sbIdx].chips);
    const bbAmt = Math.min(bb, players[bbIdx].chips);

    players[sbIdx].chips -= sbAmt;
    players[sbIdx].bet = sbAmt;
    if (players[sbIdx].chips === 0) players[sbIdx].state = "allIn";

    players[bbIdx].chips -= bbAmt;
    players[bbIdx].bet = bbAmt;
    if (players[bbIdx].chips === 0) players[bbIdx].state = "allIn";

    const utgIdx = n === 2 ? dealerIdx : (bbIdx + 1) % n;

    return {
      players,
      deck,
      community: [],
      pot: sbAmt + bbAmt,
      currentBet: bbAmt,
      minRaise: bb,
      bigBlind: bb,
      dealerIdx,
      currentPlayerIdx: utgIdx,
      phase: "preflop",
      lastAction: `Hand #${handNum} — blinds posted (SB: ${sbAmt}, BB: ${bbAmt})`,
      handNumber: handNum,
      handResult: null,
    };
  }

  const initGame = useCallback((names: string[], chips: number, bb: number) => {
    const players: LocalPlayer[] = names.map((name, id) => ({
      id,
      name,
      chips,
      holeCards: [],
      bet: 0,
      state: "active",
      status: "",
    }));
    const state = dealHand(players, 0, 1, bb);
    setGs(state);
    setShowHand(false);
    setStatus("handoff");
  }, []);

  // ─── Core action processor ──────────────────────────
  const doAction = useCallback(
    (
      action: "fold" | "check" | "call" | "raise" | "allIn",
      amount?: number,
    ) => {
      setGs((prev) => {
        if (!prev) return prev;

        const players = prev.players.map((p) => ({ ...p }));
        const actor = players[prev.currentPlayerIdx];
        const myBet = actor.bet;
        const callAmt = Math.min(prev.currentBet - myBet, actor.chips);

        let pot = prev.pot;
        let currentBet = prev.currentBet;
        let minRaise = prev.minRaise;
        let lastAction = prev.lastAction;

        switch (action) {
          case "fold": {
            actor.state = "folded";
            actor.status = "Folded";
            lastAction = `${actor.name} folds`;
            break;
          }

          case "check": {
            if (callAmt > 0) return prev;
            actor.status = "Checked";
            lastAction = `${actor.name} checks`;
            break;
          }

          case "call": {
            const actual = Math.min(callAmt, actor.chips);
            actor.chips -= actual;
            actor.bet = myBet + actual;
            pot += actual;
            if (actor.chips === 0) actor.state = "allIn";
            lastAction = `${actor.name} calls ${actual}`;
            break;
          }

          case "raise": {
            const raiseTo = amount ?? currentBet + minRaise;
            const extra = Math.min(raiseTo - myBet, actor.chips);
            actor.chips -= extra;
            actor.bet = myBet + extra;
            pot += extra;
            const newTotal = myBet + extra;
            if (newTotal > currentBet) {
              minRaise = Math.max(minRaise, newTotal - currentBet);
              currentBet = newTotal;
            }
            if (actor.chips === 0) actor.state = "allIn";
            lastAction = `${actor.name} raises to ${newTotal}`;
            break;
          }

          case "allIn": {
            const allInAmt = actor.chips;
            actor.bet = myBet + allInAmt;
            pot += allInAmt;
            actor.chips = 0;
            actor.state = "allIn";
            if (actor.bet > currentBet) {
              minRaise = Math.max(minRaise, actor.bet - currentBet);
              currentBet = actor.bet;
            }
            lastAction = `${actor.name} goes ALL IN for ${allInAmt}!`;
            break;
          }
        }

        const next: LocalGameState = {
          ...prev,
          players,
          pot,
          currentBet,
          minRaise,
          lastAction,
        };

        return advanceAfterAction(next, null);
      });
    },
    [],
  );

  // ─── Effects ────────────────────────────────────────
  useEffect(() => {
    if (gs?.handResult && status === "playing") {
      if (autoTimer.current) clearTimeout(autoTimer.current);
      autoTimer.current = setTimeout(() => setStatus("handResult"), 400);
    }
  }, [gs?.handResult, status]);

  const handleReveal = useCallback(() => {
    setShowHand(true);
    setStatus("playing");
  }, []);

  const handleNextHand = useCallback(() => {
    if (!gs) return;
    const survivors = gs.players.filter((p) => p.chips > 0);
    if (survivors.length < 2) {
      setStatus("gameOver");
      return;
    }
    const newDealerIdx = (gs.dealerIdx + 1) % survivors.length;
    const newGs = dealHand(
      survivors,
      newDealerIdx,
      gs.handNumber + 1,
      gs.bigBlind,
    );
    setGs(newGs);
    setShowHand(false);
    setStatus("handoff");
  }, [gs]);

  if (!gs && status !== "setup") return null;
  if (status === "setup") return <SetupScreen onStart={initGame} />;

  const currentPlayer = gs!.players[gs!.currentPlayerIdx];

  if (status === "gameOver") {
    const winner = gs!.players.reduce((a, b) => (a.chips > b.chips ? a : b));
    return (
      <GameOverScreen
        winner={winner}
        allPlayers={gs!.players}
        onRestart={() => {
          setGs(null);
          setStatus("setup");
        }}
      />
    );
  }

  if (status === "handResult") {
    return <HandResultScreen gs={gs!} onContinue={handleNextHand} />;
  }

  if (status === "handoff" && !showHand) {
    return <HandoffScreen player={currentPlayer} onReveal={handleReveal} />;
  }

  const handleAction = (
    action: "fold" | "check" | "call" | "raise" | "allIn",
    amount?: number,
  ) => {
    doAction(action, amount);
    setTimeout(() => {
      setGs((latest) => {
        if (!latest || latest.handResult) return latest;
        setShowHand(false);
        setStatus("handoff");
        return latest;
      });
    }, 500);
  };

  return <GameScreen gs={gs!} onAction={handleAction} />;
}
