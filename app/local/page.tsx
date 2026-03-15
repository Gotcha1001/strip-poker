"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Play,
  Eye,
  EyeOff,
  RotateCcw,
  Zap,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSoundManager } from "@/hooks/useSoundManager";

// ─── Types ────────────────────────────────────────────────────────────────────
type CardColor = "red" | "blue" | "green" | "yellow" | "wild";
type GameStatus = "setup" | "handoff" | "playing" | "finished";

interface LocalPlayer {
  id: number;
  name: string;
  hand: string[];
}

interface LocalGameState {
  players: LocalPlayer[];
  deck: string[];
  discardPile: string[];
  currentColor: string;
  currentPlayerIndex: number;
  direction: 1 | -1;
  drawStack: number;
  lastAction: string;
  status: "active" | "finished";
  winnerId: number | null;
}

// ─── Card helpers ─────────────────────────────────────────────────────────────
const COLORS: CardColor[] = ["red", "blue", "green", "yellow"];

function createDeck(): string[] {
  const deck: string[] = [];
  for (const color of COLORS) {
    deck.push(`${color}_0`);
    for (const n of [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "skip",
      "reverse",
      "draw2",
      "skip",
      "reverse",
      "draw2",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
    ]) {
      deck.push(`${color}_${n}`);
    }
  }
  for (let i = 0; i < 4; i++) deck.push("wild");
  for (let i = 0; i < 4; i++) deck.push("wild_draw4");
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

function parseCard(cardId: string): { color: string; value: string } {
  if (cardId === "wild" || cardId === "wild_draw4")
    return { color: "wild", value: cardId };
  const idx = cardId.indexOf("_");
  return { color: cardId.slice(0, idx), value: cardId.slice(idx + 1) };
}

function canPlay(card: string, topCard: string, currentColor: string): boolean {
  const { color, value } = parseCard(card);
  const { value: topValue } = parseCard(topCard);
  if (color === "wild") return true;
  if (color === currentColor) return true;
  if (value === topValue) return true;
  return false;
}

const VALUE_DISPLAY: Record<string, string> = {
  skip: "⊘",
  reverse: "⇄",
  draw2: "+2",
  wild: "★",
  wild_draw4: "+4",
};

const COLOR_GRADIENTS: Record<string, string> = {
  red: "radial-gradient(ellipse at 38% 32%, #fca5a5 0%, #ef4444 28%, #dc2626 55%, #991b1b 80%, #450a0a 100%)",
  blue: "radial-gradient(ellipse at 38% 32%, #bfdbfe 0%, #3b82f6 28%, #2563eb 55%, #1e40af 80%, #172554 100%)",
  green:
    "radial-gradient(ellipse at 38% 32%, #bbf7d0 0%, #22c55e 28%, #16a34a 55%, #166534 80%, #052e16 100%)",
  yellow:
    "radial-gradient(ellipse at 38% 32%, #fef9c3 0%, #facc15 28%, #eab308 55%, #a16207 80%, #422006 100%)",
  wild: "radial-gradient(ellipse at 38% 32%, #f0abfc 0%, #a855f7 28%, #7c3aed 55%, #4338ca 78%, #1e1b4b 100%)",
};

const COLOR_HEX: Record<string, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  yellow: "#eab308",
  wild: "#a855f7",
};

const COLOR_GLOW: Record<string, string> = {
  red: "rgba(239,68,68,0.6)",
  blue: "rgba(59,130,246,0.6)",
  green: "rgba(34,197,94,0.6)",
  yellow: "rgba(234,179,8,0.6)",
  wild: "rgba(168,85,247,0.6)",
};

// ─── UNO Card ─────────────────────────────────────────────────────────────────
function UnoCardLocal({
  cardId,
  size = "md",
  isPlayable = false,
  isSelected = false,
  onClick,
  index = 0,
}: {
  cardId: string;
  size?: "sm" | "md" | "lg";
  isPlayable?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  index?: number;
}) {
  const { color, value } = parseCard(cardId);
  const displayValue = VALUE_DISPLAY[value] ?? value.toUpperCase();
  const bg = COLOR_GRADIENTS[color] ?? COLOR_GRADIENTS.wild;
  const glow = COLOR_GLOW[color] ?? COLOR_GLOW.wild;
  const hex = COLOR_HEX[color] ?? COLOR_HEX.wild;

  const sizes = {
    sm: {
      outer: "w-10 h-14",
      corner: "text-[0.5rem]",
      center: "0.55rem",
      radius: "rounded-xl",
    },
    md: {
      outer: "w-16 h-24",
      corner: "text-[0.65rem]",
      center: "1rem",
      radius: "rounded-2xl",
    },
    lg: {
      outer: "w-20 h-28",
      corner: "text-[0.75rem]",
      center: "1.2rem",
      radius: "rounded-2xl",
    },
  };
  const s = sizes[size];

  return (
    <motion.div
      className={`relative select-none flex-shrink-0 ${s.outer} ${s.radius} ${isPlayable ? "cursor-pointer" : "cursor-default"}`}
      style={{
        boxShadow: isSelected
          ? `0 0 0 3px white, 0 0 0 5px ${hex}, 0 0 32px ${glow}, 0 12px 28px rgba(0,0,0,0.55)`
          : isPlayable
            ? `0 0 0 2px ${glow}, 0 0 18px ${glow}, 0 6px 16px rgba(0,0,0,0.5)`
            : "0 4px 14px rgba(0,0,0,0.4)",
      }}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.03,
        type: "spring",
        stiffness: 300,
        damping: 22,
      }}
      whileHover={isPlayable ? { y: -14, scale: 1.1 } : undefined}
      whileTap={isPlayable ? { scale: 0.93 } : undefined}
      onClick={isPlayable ? onClick : undefined}
    >
      <div
        className={`absolute inset-0 overflow-hidden ${s.radius}`}
        style={{ background: bg }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 22% 18%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 35%, transparent 60%)",
          }}
        />
        <div
          className={`absolute inset-[3px] pointer-events-none border border-white/20 ${s.radius}`}
        />
        <span
          className={`absolute top-1.5 left-2 font-black text-white leading-none ${s.corner}`}
          style={{ textShadow: "0 1px 4px rgba(0,0,0,0.65)" }}
        >
          {displayValue}
        </span>
        <span
          className={`absolute bottom-1.5 right-2 font-black text-white leading-none rotate-180 ${s.corner}`}
          style={{ textShadow: "0 1px 4px rgba(0,0,0,0.65)" }}
        >
          {displayValue}
        </span>
        <div
          className="absolute top-1/2 left-1/2 flex items-center justify-center"
          style={{
            width: "60%",
            height: "65%",
            transform: "translate(-50%, -50%) rotate(-22deg)",
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at 40% 35%, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.3) 100%)",
            border: "1.5px solid rgba(255,255,255,0.2)",
          }}
        >
          <span
            className="font-black text-white relative z-10"
            style={{
              fontSize: s.center,
              transform: "rotate(22deg)",
              textShadow: "0 2px 8px rgba(0,0,0,0.7)",
            }}
          >
            {displayValue}
          </span>
        </div>
        {isPlayable && (
          <motion.div
            className={`absolute inset-0 pointer-events-none ${s.radius}`}
            animate={{ opacity: [0, 0.5, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            style={{
              background: `radial-gradient(ellipse at 50% 50%, ${glow} 0%, transparent 72%)`,
            }}
          />
        )}
      </div>
    </motion.div>
  );
}

function CardBackLocal({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: { outer: "w-10 h-14", radius: "rounded-xl" },
    md: { outer: "w-16 h-24", radius: "rounded-2xl" },
    lg: { outer: "w-20 h-28", radius: "rounded-2xl" },
  };
  const s = sizes[size];
  return (
    <div
      className={`relative select-none flex-shrink-0 ${s.outer} ${s.radius}`}
      style={{ boxShadow: "0 4px 14px rgba(0,0,0,0.45)" }}
    >
      <div
        className={`absolute inset-0 overflow-hidden ${s.radius}`}
        style={{
          background:
            "radial-gradient(ellipse at 38% 32%, #7c3aed 0%, #4c1d95 35%, #2e1065 65%, #0f0520 100%)",
        }}
      >
        <div
          className="absolute inset-[5px] rounded-lg border border-purple-400/20"
          style={{
            background:
              "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(139,92,246,0.07) 5px, rgba(139,92,246,0.07) 10px)",
          }}
        />
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-black text-white/25 tracking-[0.2em] text-[0.5rem]">
          UNO
        </span>
      </div>
    </div>
  );
}

// ─── Color Picker ─────────────────────────────────────────────────────────────
const COLOR_OPTIONS = ["red", "blue", "green", "yellow"] as const;

function ColorPicker({ onPick }: { onPick: (c: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
    >
      <motion.div
        initial={{ scale: 0.7, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 26 }}
        className="p-7 rounded-3xl border border-white/20 text-center"
        style={{
          background:
            "linear-gradient(145deg, rgba(30,15,60,0.97) 0%, rgba(15,10,40,0.97) 100%)",
          boxShadow:
            "0 30px 80px rgba(0,0,0,0.8), 0 0 60px rgba(139,92,246,0.3)",
        }}
      >
        <h3 className="font-black text-2xl mb-1 text-white">Choose a Color</h3>
        <p className="text-white/40 text-xs mb-5 uppercase tracking-widest">
          Wild card played
        </p>
        <div className="grid grid-cols-2 gap-3">
          {COLOR_OPTIONS.map((color) => (
            <motion.button
              key={color}
              whileHover={{ scale: 1.06, y: -2 }}
              whileTap={{ scale: 0.94 }}
              className="w-28 h-20 rounded-2xl capitalize font-black text-white text-lg relative overflow-hidden"
              style={{
                background: COLOR_GRADIENTS[color],
                boxShadow: `0 6px 24px ${COLOR_GLOW[color]}`,
                textShadow: "0 2px 6px rgba(0,0,0,0.5)",
              }}
              onClick={() => onPick(color)}
            >
              {color}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── SETUP SCREEN ─────────────────────────────────────────────────────────────
function SetupScreen({ onStart }: { onStart: (names: string[]) => void }) {
  const [playerCount, setPlayerCount] = useState(2);
  const [names, setNames] = useState([
    "Player 1",
    "Player 2",
    "Player 3",
    "Player 4",
  ]);

  const updateName = (i: number, val: string) => {
    const n = [...names];
    n[i] = val;
    setNames(n);
  };

  const DEMO_CARDS = [
    { color: "bg-red-500", value: "7", rotate: -18, x: -110, y: 10 },
    { color: "bg-blue-500", value: "⊘", rotate: -6, x: -55, y: -12 },
    { color: "bg-yellow-400", value: "2", rotate: 4, x: 0, y: 4 },
    { color: "bg-green-500", value: "⇄", rotate: 14, x: 55, y: -8 },
    {
      color: "bg-gradient-to-br from-red-500 via-yellow-400 to-blue-500",
      value: "+4",
      rotate: 24,
      x: 110,
      y: 10,
    },
  ];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center overflow-hidden bg-white dark:bg-indigo-950 py-12">
      <div className="hidden dark:block absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-[-250px] left-[-250px] w-[700px] h-[700px] rounded-full bg-purple-900 opacity-40"
          animate={{ scale: [1, 1.3, 1], x: [0, 120, 0], y: [0, -80, 0] }}
          transition={{ duration: 25, repeat: Infinity, repeatType: "mirror" }}
        />
        <motion.div
          className="absolute bottom-[-300px] right-[-300px] w-[800px] h-[800px] rounded-full bg-purple-950 opacity-30"
          animate={{ scale: [1, 1.25, 1], x: [0, -100, 0], y: [0, 100, 0] }}
          transition={{ duration: 30, repeat: Infinity, repeatType: "mirror" }}
        />
      </div>

      <div className="relative h-40 w-full max-w-sm mb-8">
        {DEMO_CARDS.map((card, i) => (
          <motion.div
            key={i}
            className={`absolute w-14 h-20 rounded-2xl ${card.color} shadow-xl border-2 border-white/30 flex items-center justify-center`}
            style={{
              left: "50%",
              top: "50%",
              marginLeft: card.x - 28,
              marginTop: card.y - 40,
              rotate: card.rotate,
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
            <div className="bg-white/20 rounded-full w-9 h-12 flex items-center justify-center border border-white/30">
              <span className="font-bold text-white text-sm drop-shadow">
                {card.value}
              </span>
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
          🃏 Play Locally
        </h1>
        <p className="mt-2 text-gray-500 dark:text-purple-300">
          Pass the device between players — up to 4 people on one screen
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="w-full max-w-md p-6 rounded-2xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-purple-950/40 shadow-xl relative z-10"
      >
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 dark:text-purple-200 mb-3">
            <Users className="inline h-4 w-4 mr-1" /> Number of Players
          </label>
          <div className="flex gap-2">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setPlayerCount(n)}
                className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all ${
                  playerCount === n
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                    : "bg-gray-100 dark:bg-purple-900/30 text-gray-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <label className="block text-sm font-semibold text-gray-700 dark:text-purple-200 mb-2">
            Player Names
          </label>
          {Array.from({ length: playerCount }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {i + 1}
                </div>
                <input
                  type="text"
                  value={names[i]}
                  onChange={(e) => updateName(i, e.target.value)}
                  placeholder={`Player ${i + 1}`}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none bg-gray-50 dark:bg-purple-900/30 border border-gray-200 dark:border-purple-700 text-black dark:text-white placeholder:text-gray-400"
                />
              </div>
            </motion.div>
          ))}
        </div>

        <Button
          className="w-full py-6 text-lg bg-purple-600 hover:bg-purple-500 text-white shadow-lg"
          onClick={() => onStart(names.slice(0, playerCount))}
        >
          <Play className="h-5 w-5 mr-2" /> Start Game
        </Button>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-6 text-sm text-gray-400 dark:text-purple-500 max-w-sm relative z-10"
      >
        Each player sees their own hand privately. After your turn, pass the
        device to the next player.
      </motion.p>
    </main>
  );
}

// ─── HANDOFF SCREEN ───────────────────────────────────────────────────────────
function HandoffScreen({
  player,
  onReveal,
}: {
  player: LocalPlayer;
  onReveal: () => void;
}) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #1a0a3e 0%, #0d0621 50%, #050312 100%)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-sm w-full"
      >
        <div className="mb-8">
          <motion.div
            className="w-24 h-24 rounded-3xl bg-purple-600 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-purple-500/40"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <EyeOff className="h-10 w-10 text-white" />
          </motion.div>
          <h2 className="text-3xl font-black text-white mb-2">Hand Off!</h2>
          <p className="text-purple-300">Pass the device to</p>
          {/* ── Fixed: px-4 + break-words prevents long names from clipping ── */}
          <p className="text-3xl font-black text-white mt-1 px-4 break-words leading-tight">
            {player.name}
          </p>
          <p className="text-purple-300 mt-2 text-sm">
            ({player.hand.length} cards in hand)
          </p>
        </div>

        <div className="flex justify-center gap-2 mb-8">
          {Array.from({ length: Math.min(player.hand.length, 7) }).map(
            (_, i) => (
              <div key={i} style={{ transform: `rotate(${(i - 3) * 5}deg)` }}>
                <CardBackLocal size="sm" />
              </div>
            ),
          )}
          {player.hand.length > 7 && (
            <div className="w-10 h-14 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-[10px] font-bold text-white/60">
              +{player.hand.length - 7}
            </div>
          )}
        </div>

        <p className="text-purple-400 text-sm mb-6">
          Make sure nobody else is looking before revealing your cards!
        </p>

        <Button
          className="w-full py-5 text-lg bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/30"
          onClick={onReveal}
        >
          <Eye className="h-5 w-5 mr-2" /> Reveal My Hand
        </Button>
      </motion.div>
    </div>
  );
}

// ─── GAME SCREEN ──────────────────────────────────────────────────────────────
function GameScreen({
  gameState,
  currentPlayer,
  actionTaken,
  onPlayCard,
  onDrawCard,
  onNextTurn,
}: {
  gameState: LocalGameState;
  currentPlayer: LocalPlayer;
  actionTaken: boolean;
  onPlayCard: (cardId: string, chosenColor?: string) => void;
  onDrawCard: () => void;
  onNextTurn: () => void;
}) {
  const { play, setMuted } = useSoundManager();
  const [muted, setMutedState] = useState(false);
  const [pendingWild, setPendingWild] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const topCard = gameState.discardPile[gameState.discardPile.length - 1];
  const currentColor = gameState.currentColor;
  const currentGlow = COLOR_GLOW[currentColor] ?? COLOR_GLOW.wild;
  const currentHex = COLOR_HEX[currentColor] ?? COLOR_HEX.wild;

  const prevHandLength = useRef<number | null>(null);

  // ── UNO alert when hand drops to 1 card ──────────────────────────────────
  useEffect(() => {
    if (
      prevHandLength.current !== null &&
      prevHandLength.current > 1 &&
      currentPlayer.hand.length === 1
    ) {
      play("unoAlert");
    }
    prevHandLength.current = currentPlayer.hand.length;
  }, [currentPlayer.hand.length, play]);

  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
  };

  const handleCardClick = (cardId: string) => {
    if (!canPlay(cardId, topCard, currentColor)) return;

    // Draw stack enforcement
    if (gameState.drawStack > 0) {
      const { value } = parseCard(cardId);
      const { value: topValue } = parseCard(topCard);
      if (topValue === "draw2" && value !== "draw2") return;
      if (topCard === "wild_draw4" && cardId !== "wild_draw4") return;
      if (value === "wild") return;
    }

    const { color, value } = parseCard(cardId);

    // ── Card sound ────────────────────────────────────────────────────────
    if (value === "wild" || cardId === "wild_draw4") {
      play("cardPlayWild");
    } else {
      play("cardPlay", color);
    }

    if (value === "wild" || cardId === "wild_draw4") {
      setSelectedCard(cardId);
      setPendingWild(cardId);
      setShowColorPicker(true);
      return;
    }
    setSelectedCard(cardId);
    onPlayCard(cardId);
  };

  const handleColorPick = (color: string) => {
    play("buttonClick");
    setShowColorPicker(false);
    if (pendingWild) {
      onPlayCard(pendingWild, color);
      setPendingWild(null);
      setSelectedCard(null);
    }
  };

  const handleDraw = () => {
    play("cardDraw");
    onDrawCard();
  };

  return (
    <div
      className="min-h-screen flex flex-col overflow-hidden relative"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #1a4a2e 0%, #0f2d1c 45%, #091a10 100%)",
      }}
    >
      {/* Felt texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
          zIndex: 0,
        }}
      />

      {/* Color ambient glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.06, 0.12, 0.06] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 50%, ${currentGlow}, transparent)`,
          zIndex: 1,
        }}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/20 backdrop-blur-sm gap-2">
        {/* Left: deck count */}
        <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/20 bg-black/30 text-xs font-semibold text-white/70">
          🃏 <span>{gameState.deck.length}</span>
        </div>

        {/* Center: current player — more padding, brighter, slightly larger */}
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center px-3">
          <span className="text-[10px] text-white/40 uppercase tracking-widest leading-none mb-0.5">
            Now Playing
          </span>
          <span className="text-base font-black text-white truncate w-full text-center leading-snug">
            {currentPlayer.name}
          </span>
        </div>

        {/* Right: mute button + player indicator dots */}
        <div className="flex-shrink-0 flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="p-1.5 rounded-xl border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-all"
            title={muted ? "Unmute sounds" : "Mute sounds"}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <div className="flex items-center gap-1">
            {gameState.players.map((p, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === gameState.currentPlayerIndex
                    ? "w-3 h-3 bg-purple-400"
                    : "w-2 h-2 bg-white/20"
                }`}
                title={p.name}
              />
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
        {/* Other players card counts */}
        <div className="flex justify-center gap-3 pt-6 pb-2 px-4 flex-wrap">
          {gameState.players
            .filter((_, i) => i !== gameState.currentPlayerIndex)
            .map((p) => (
              <div key={p.id} className="flex flex-col items-center gap-3">
                {/* Truncate long opponent names too */}
                <div className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/20 bg-black/30 text-white/70 max-w-[110px] truncate">
                  {p.name} · {p.hand.length}
                </div>
                <div className="flex items-end" style={{ height: "2.5rem" }}>
                  {Array.from({ length: Math.min(p.hand.length, 5) }).map(
                    (_, j, arr) => {
                      const mid = (arr.length - 1) / 2;
                      return (
                        <div
                          key={j}
                          className="-ml-2 first:ml-0"
                          style={{
                            transform: `rotate(${(j - mid) * 6}deg) translateY(${Math.abs(j - mid) * 2}px)`,
                            transformOrigin: "bottom center",
                          }}
                        >
                          <CardBackLocal size="sm" />
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            ))}
        </div>

        {/* Center play area */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
          {/* Last action log */}
          <AnimatePresence mode="wait">
            <motion.div
              key={gameState.lastAction}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="text-xs text-center px-4 py-2 rounded-xl max-w-xs border border-white/15 bg-black/30 backdrop-blur-sm text-white/70"
            >
              {gameState.lastAction}
            </motion.div>
          </AnimatePresence>

          {/* Turn indicator — truncate long names */}
          <motion.div
            className="flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-bold backdrop-blur-sm max-w-[260px] w-full justify-center"
            style={{
              background: "rgba(147,51,234,0.2)",
              borderColor: "#a855f7",
              color: "#d8b4fe",
              boxShadow: "0 0 24px rgba(147,51,234,0.4)",
            }}
          >
            <motion.span
              className="flex-shrink-0"
              animate={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
            >
              🎯
            </motion.span>
            <span className="truncate">{currentPlayer.name}&apos;s turn!</span>
            <Zap size={14} className="text-purple-400 flex-shrink-0" />
          </motion.div>

          {/* Color / direction / draw stack pills */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/30 border border-white/15 backdrop-blur-sm">
              <span className="text-[10px] text-white/50 uppercase tracking-wider">
                Color
              </span>
              <motion.div
                className="w-4 h-4 rounded-full border-2 border-white/50"
                animate={{
                  boxShadow: [
                    `0 0 8px ${currentGlow}`,
                    `0 0 20px ${currentGlow}`,
                    `0 0 8px ${currentGlow}`,
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ background: currentHex }}
              />
              <span className="text-xs font-semibold capitalize text-white">
                {currentColor}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-black/30 border border-white/15 text-xs text-white/60">
              {gameState.direction === 1 ? "↻ CW" : "↺ CCW"}
            </div>
            {gameState.drawStack > 0 && (
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                className="px-3 py-1.5 rounded-xl bg-red-900/50 border border-red-500/50 text-xs font-bold text-red-300"
              >
                +{gameState.drawStack} pending!
              </motion.div>
            )}
          </div>

          {/* Draw pile + Discard pile */}
          <div className="flex items-center gap-10">
            <div className="flex flex-col items-center gap-2">
              <motion.div
                className="relative cursor-pointer"
                whileHover={{ scale: 1.07, y: -4 }}
                whileTap={{ scale: 0.94 }}
                onClick={handleDraw}
                style={{
                  filter: "drop-shadow(0 6px 20px rgba(139,92,246,0.6))",
                }}
              >
                <div className="absolute top-[3px] left-[2px] opacity-40">
                  <CardBackLocal size="lg" />
                </div>
                <div className="absolute top-[1.5px] left-[1px] opacity-65">
                  <CardBackLocal size="lg" />
                </div>
                <CardBackLocal size="lg" />
              </motion.div>
              <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">
                Draw
              </span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <motion.div
                  className="absolute inset-[-6px] rounded-[20px] pointer-events-none"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                  style={{
                    boxShadow: `0 0 30px 6px ${currentGlow}`,
                    borderRadius: "20px",
                  }}
                />
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={topCard}
                    initial={{ scale: 0.6, opacity: 0, rotateY: 90, y: -20 }}
                    animate={{ scale: 1, opacity: 1, rotateY: 0, y: 0 }}
                    exit={{ scale: 0.8, opacity: 0, y: 10 }}
                    transition={{ type: "spring", stiffness: 320, damping: 24 }}
                    style={{ filter: `drop-shadow(0 8px 24px ${currentGlow})` }}
                  >
                    <UnoCardLocal cardId={topCard} size="lg" index={0} />
                  </motion.div>
                </AnimatePresence>
              </div>
              <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">
                Discard
              </span>
            </div>
          </div>
        </div>

        {/* ── Player hand panel ───────────────────────────────────────────── */}
        <div
          className="relative border-t border-white/10 bg-black/40 backdrop-blur-md px-4 pt-3 pb-4"
          style={{ boxShadow: "0 -8px 32px rgba(0,0,0,0.5)" }}
        >
          <div className="flex items-center justify-between mb-3 gap-2">
            {/* Truncate long names in the hand label */}
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40 truncate min-w-0">
              {currentPlayer.name}&apos;s Hand ({currentPlayer.hand.length})
            </span>
            {currentPlayer.hand.length === 1 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-3 py-1 rounded-full font-black text-xs tracking-widest flex-shrink-0"
                style={{
                  background:
                    "linear-gradient(90deg, #ff2d2d, #ffe835, #1fc95b, #2d8bff)",
                  color: "white",
                  textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                  boxShadow: "0 0 20px rgba(255,100,100,0.6)",
                }}
              >
                UNO! 🔥
              </motion.div>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-1.5 max-h-44 overflow-y-auto pb-1">
            {!actionTaken &&
              currentPlayer.hand.map((cardId, i) => {
                let playable = canPlay(cardId, topCard, currentColor);
                if (playable && gameState.drawStack > 0) {
                  const { value } = parseCard(cardId);
                  const { value: topValue } = parseCard(topCard);
                  if (topValue === "draw2" && value !== "draw2")
                    playable = false;
                  if (topCard === "wild_draw4" && cardId !== "wild_draw4")
                    playable = false;
                  if (value === "wild") playable = false;
                }
                return (
                  <UnoCardLocal
                    key={`${cardId}-${i}`}
                    cardId={cardId}
                    size="md"
                    isPlayable={playable}
                    isSelected={selectedCard === cardId}
                    onClick={() => handleCardClick(cardId)}
                    index={i}
                  />
                );
              })}
          </div>

          {gameState.drawStack > 0 && !actionTaken && (
            <p className="text-center text-xs text-red-400 mt-2 font-semibold">
              Play a matching card, or draw {gameState.drawStack} cards!
            </p>
          )}

          {/* Auto-advance indicator */}
          <div className="mt-3 flex justify-center min-h-[40px] items-center">
            <AnimatePresence mode="wait">
              {actionTaken ? (
                <motion.div
                  key="passing"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600/30 border border-purple-500/40 text-purple-200 text-sm font-semibold"
                >
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="inline-block"
                  >
                    ⏳
                  </motion.span>
                  Passing to next player…
                </motion.div>
              ) : (
                <motion.p
                  key="hint"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-white/30 font-medium"
                >
                  Play a card or draw to end your turn
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showColorPicker && <ColorPicker onPick={handleColorPick} />}
      </AnimatePresence>
    </div>
  );
}

// ─── WIN SCREEN ───────────────────────────────────────────────────────────────
function WinScreen({
  winner,
  onRestart,
}: {
  winner: LocalPlayer;
  onRestart: () => void;
}) {
  const { play } = useSoundManager();

  useEffect(() => {
    play("win");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-950 px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
      >
        <motion.div
          className="text-8xl mb-6"
          animate={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          🏆
        </motion.div>
        {/* break-words prevents long winner names overflowing */}
        <h1 className="text-4xl md:text-5xl font-black text-white mb-3 px-4 break-words">
          {winner.name} Wins!
        </h1>
        <p className="text-purple-300 text-lg mb-8">
          Congratulations! All cards played! 🎉
        </p>
        <Button
          className="bg-purple-600 hover:bg-purple-500 text-white px-12 py-5 text-lg"
          onClick={onRestart}
        >
          <RotateCcw className="h-5 w-5 mr-2" /> Play Again
        </Button>
      </motion.div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function LocalPlayPage() {
  const [gameStatus, setGameStatus] = useState<GameStatus>("setup");
  const [gameState, setGameState] = useState<LocalGameState | null>(null);
  const [showHand, setShowHand] = useState(false);
  const [actionTaken, setActionTaken] = useState(false);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { play } = useSoundManager();

  const gameStateRef = useRef<LocalGameState | null>(null);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, []);

  // Schedule handoff after a card is played or drawn
  const scheduleHandoff = useCallback(() => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    autoAdvanceTimer.current = setTimeout(() => {
      autoAdvanceTimer.current = null;
      setActionTaken(false);
      setShowHand(false);
      setGameStatus("handoff");
    }, 1500);
  }, []);

  const initGame = useCallback(
    (playerNames: string[]) => {
      let deck = createDeck();
      const players: LocalPlayer[] = playerNames.map((name, i) => ({
        id: i,
        name,
        hand: deck.splice(0, 7),
      }));

      let firstCard = deck.shift()!;
      while (firstCard.startsWith("wild")) {
        deck.push(firstCard);
        deck = shuffle(deck);
        firstCard = deck.shift()!;
      }
      const { color: firstColor } = parseCard(firstCard);

      play("gameStart");
      setTimeout(() => play("cardDeal"), 800);

      setActionTaken(false);
      setGameState({
        players,
        deck,
        discardPile: [firstCard],
        currentColor: firstColor,
        currentPlayerIndex: 0,
        direction: 1,
        drawStack: 0,
        lastAction: `Game started! ${firstCard} is the first card`,
        status: "active",
        winnerId: null,
      });
      setShowHand(false);
      setGameStatus("handoff");
    },
    [play],
  );

  const handlePlayCard = useCallback(
    (cardId: string, chosenColor?: string) => {
      const g = gameStateRef.current;
      if (!g) return;

      // Compute shouldHandoff synchronously BEFORE setGameState
      const { value } = parseCard(cardId);
      const numPlayers = g.players.length;
      const isPlayAgain =
        numPlayers === 2 && (value === "skip" || value === "reverse");
      const shouldHandoff = !isPlayAgain;

      setActionTaken(!isPlayAgain ? true : false);
      setGameState((prev) => {
        if (!prev) return prev;
        const gs = { ...prev };
        const player = { ...gs.players[gs.currentPlayerIndex] };
        const cardIdx = player.hand.indexOf(cardId);
        if (cardIdx === -1) return prev;

        const newHand = [...player.hand];
        newHand.splice(cardIdx, 1);
        player.hand = newHand;

        if (newHand.length === 0) {
          const newPlayers = gs.players.map((p, i) =>
            i === gs.currentPlayerIndex ? player : p,
          );
          return {
            ...gs,
            players: newPlayers,
            discardPile: [...gs.discardPile, cardId],
            winnerId: player.id,
            status: "finished",
            lastAction: `🎉 ${player.name} wins!`,
          };
        }

        const { color, value: v } = parseCard(cardId);
        const newColor = color === "wild" ? (chosenColor ?? "red") : color;
        const np = gs.players.length;
        let newDir = gs.direction as 1 | -1;
        let nextIdx = gs.currentPlayerIndex;
        let newStack = gs.drawStack;
        let lastAction = `${player.name} played ${cardId}`;

        if (v === "reverse") {
          newDir = (newDir * -1) as 1 | -1;
          if (np === 2) {
            nextIdx = gs.currentPlayerIndex;
            lastAction += " — Play again!";
          } else {
            nextIdx = (nextIdx + newDir + np) % np;
            lastAction += " — Direction reversed!";
          }
        } else if (v === "skip") {
          if (np === 2) {
            nextIdx = gs.currentPlayerIndex;
            lastAction += " — Play again!";
          } else {
            nextIdx = (nextIdx + newDir * 2 + np * 2) % np;
            lastAction += " — Next player skipped!";
          }
        } else if (v === "draw2") {
          newStack += 2;
          nextIdx = (nextIdx + newDir + np) % np;
          lastAction += ` — Next player must draw ${newStack}!`;
        } else if (cardId === "wild_draw4") {
          newStack += 4;
          nextIdx = (nextIdx + newDir + np) % np;
          lastAction += ` — Next player must draw ${newStack}!`;
        } else {
          nextIdx = (nextIdx + newDir + np) % np;
          newStack = 0;
        }

        if (v !== "draw2" && cardId !== "wild_draw4") newStack = 0;
        if (cardId === "wild") lastAction += ` — Color changed to ${newColor}!`;
        if (cardId === "wild_draw4")
          lastAction += ` — Color changed to ${newColor}!`;

        const newPlayers = gs.players.map((p, i) =>
          i === gs.currentPlayerIndex ? player : p,
        );
        return {
          ...gs,
          players: newPlayers,
          discardPile: [...gs.discardPile, cardId],
          currentColor: newColor,
          currentPlayerIndex: nextIdx,
          direction: newDir,
          drawStack: newStack,
          lastAction,
        };
      });

      if (shouldHandoff) {
        scheduleHandoff();
      }
      // else: isPlayAgain — actionTaken is false, player keeps their turn
    },
    [scheduleHandoff],
  );

  const handleDrawCard = useCallback(() => {
    setActionTaken(true);
    setGameState((prev) => {
      if (!prev) return prev;
      const g = { ...prev };
      let deck = [...g.deck];
      let discardPile = [...g.discardPile];
      const drawCount = g.drawStack > 0 ? g.drawStack : 1;

      if (deck.length < drawCount) {
        const top = discardPile.pop()!;
        deck = [...deck, ...shuffle(discardPile)];
        discardPile = [top];
      }
      const drawn = deck.splice(0, drawCount);
      const player = { ...g.players[g.currentPlayerIndex] };
      player.hand = [...player.hand, ...drawn];

      const numPlayers = g.players.length;
      const nextIdx =
        (g.currentPlayerIndex + g.direction + numPlayers) % numPlayers;
      const newPlayers = g.players.map((p, i) =>
        i === g.currentPlayerIndex ? player : p,
      );
      return {
        ...g,
        players: newPlayers,
        deck,
        discardPile,
        drawStack: 0,
        currentPlayerIndex: nextIdx,
        lastAction: `${player.name} drew ${drawCount} card${drawCount > 1 ? "s" : ""}`,
      };
    });
    scheduleHandoff();
  }, [scheduleHandoff]);

  const handleNextTurn = useCallback(() => {
    setActionTaken(false);
    setShowHand(false);
    setGameStatus("handoff");
  }, []);

  // ── Finished: show win screen (null-safe — no TS error) ───────────────────
  if (gameState?.status === "finished" && gameState.winnerId !== null) {
    const winner = gameState.players.find((p) => p.id === gameState.winnerId)!;
    return (
      <WinScreen
        winner={winner}
        onRestart={() => {
          setGameStatus("setup");
          setGameState(null);
        }}
      />
    );
  }

  if (gameStatus === "setup") {
    return <SetupScreen onStart={initGame} />;
  }

  if (!gameState) return null;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  if (gameStatus === "handoff" && !showHand) {
    return (
      <HandoffScreen
        player={currentPlayer}
        onReveal={() => {
          play("yourTurn");
          setActionTaken(false);
          setShowHand(true);
          setGameStatus("playing");
        }}
      />
    );
  }

  return (
    <GameScreen
      gameState={gameState}
      currentPlayer={currentPlayer}
      actionTaken={actionTaken}
      onPlayCard={handlePlayCard}
      onDrawCard={handleDrawCard}
      onNextTurn={handleNextTurn}
    />
  );
}
