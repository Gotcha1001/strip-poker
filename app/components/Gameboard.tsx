"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { UnoCard, CardBack, parseCard } from "./UnoCard";
import { useRouter } from "next/navigation";
import { ArrowLeft, Volume2, VolumeX, Zap } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { useBackground } from "../context/BackgroundContext";
import { useSoundManager } from "@/hooks/useSoundManager";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Room {
  _id: Id<"rooms">;
  _creationTime: number;
  name: string;
  hostId: string;
  hostName: string;
  status: "waiting" | "playing" | "finished";
  maxPlayers: number;
  playerIds: string[];
  createdAt: number;
}

interface Player {
  _id: Id<"players">;
  _creationTime: number;
  roomId: Id<"rooms">;
  userId: string;
  name: string;
  avatarUrl?: string | undefined;
  isBot: boolean;
  isReady: boolean;
  isConnected: boolean;
  hand: string[];
  seatIndex: number;
}

interface Game {
  _id: Id<"games">;
  _creationTime: number;
  roomId: Id<"rooms">;
  deck: string[];
  discardPile: string[];
  currentColor: string;
  currentPlayerIndex: number;
  playerOrder: string[];
  direction: number;
  drawStack: number;
  lastAction?: string | undefined;
  winnerId?: string | undefined;
  status: "active" | "finished";
  createdAt: number;
}

interface GameBoardProps {
  room: Room;
  game: Game;
  players: Player[];
  currentUserId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function canPlayCard(
  card: string,
  topCard: string,
  currentColor: string,
): boolean {
  const { color, value } = parseCard(card);
  const { value: topValue } = parseCard(topCard);
  if (color === "wild") return true;
  if (color === currentColor) return true;
  if (value === topValue) return true;
  return false;
}

// Respects the draw stack — same logic as the server penalty guard
function isCardPlayable(
  cardId: string,
  topCard: string,
  currentColor: string,
  drawStack: number,
): boolean {
  if (!canPlayCard(cardId, topCard, currentColor)) return false;
  if (drawStack > 0) {
    const { value } = parseCard(cardId);
    const { value: topValue } = parseCard(topCard);
    if (topValue === "draw2" && value !== "draw2") return false;
    if (topCard === "wild_draw4" && cardId !== "wild_draw4") return false;
    if (value === "wild") return false;
  }
  return true;
}

const COLOR_OPTIONS = ["red", "blue", "green", "yellow"] as const;

const COLOR_HEX: Record<string, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  yellow: "#eab308",
};

const COLOR_GLOW: Record<string, string> = {
  red: "rgba(239,68,68,0.5)",
  blue: "rgba(59,130,246,0.5)",
  green: "rgba(34,197,94,0.5)",
  yellow: "rgba(234,179,8,0.5)",
};

const TABLE_BG =
  "radial-gradient(ellipse at 50% 40%, #1a4a2e 0%, #0f2d1c 45%, #091a10 100%)";

// ─── Component ────────────────────────────────────────────────────────────────

export function GameBoard({
  room,
  game,
  players,
  currentUserId,
}: GameBoardProps) {
  const router = useRouter();
  const playCard = useMutation(api.game.playCard);
  const drawCard = useMutation(api.game.drawCard);
  const playerHand = useQuery(api.game.getPlayerHand, {
    roomId: room._id,
    userId: currentUserId,
  });

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingWildCard, setPendingWildCard] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const { selected: boardBg } = useBackground();

  // ── Sound ──────────────────────────────────────────────────────────────────
  const { play, setMuted, isMuted } = useSoundManager();
  const [muted, setMutedState] = useState(false);
  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
  };

  // Track previous state for reactive sounds
  const prevIsMyTurn = useRef(false);
  const prevHandLength = useRef<number | null>(null);
  const prevGameStatus = useRef<string>("active");
  const dealPlayed = useRef(false);

  // ── Derived ────────────────────────────────────────────────────────────────
  const currentPlayerId = game.playerOrder[game.currentPlayerIndex];
  const isMyTurn = currentPlayerId === currentUserId;
  const topCard = game.discardPile[game.discardPile.length - 1];
  const opponents = players.filter((p) => p.userId !== currentUserId);
  const currentPlayerName =
    players.find((p) => p.userId === currentPlayerId)?.name ?? "Unknown";
  const currentGlow = COLOR_GLOW[game.currentColor] ?? "rgba(147,51,234,0.5)";
  const currentHex = COLOR_HEX[game.currentColor] ?? "#9333ea";

  // ── Sound effects (reactive) ───────────────────────────────────────────────

  useEffect(() => {
    if (!dealPlayed.current && game.status === "active") {
      dealPlayed.current = true;
      setTimeout(() => play("cardDeal"), 300);
    }
  }, [game.status, play]);

  useEffect(() => {
    if (isMyTurn && !prevIsMyTurn.current) {
      play("yourTurn");
    }
    prevIsMyTurn.current = isMyTurn;
  }, [isMyTurn, play]);

  useEffect(() => {
    if (playerHand === undefined) return;
    if (
      prevHandLength.current !== null &&
      prevHandLength.current > 1 &&
      playerHand.length === 1
    ) {
      play("unoAlert");
    }
    prevHandLength.current = playerHand.length;
  }, [playerHand, play]);

  useEffect(() => {
    if (prevGameStatus.current !== "finished" && game.status === "finished") {
      if (game.winnerId === currentUserId) {
        play("win");
      } else {
        play("lose");
      }
    }
    prevGameStatus.current = game.status;
  }, [game.status, game.winnerId, currentUserId, play]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCardClick = async (cardId: string) => {
    if (!isMyTurn) {
      toast.error("Not your turn!");
      return;
    }

    // Basic playability check
    if (!canPlayCard(cardId, topCard, game.currentColor)) {
      toast.error("Can't play that card");
      return;
    }

    // ── Draw stack enforcement (client-side mirror of server rule) ────────────
    if (game.drawStack > 0) {
      const { value } = parseCard(cardId);
      const { value: topValue } = parseCard(topCard);
      if (topValue === "draw2" && value !== "draw2") {
        toast.error("You must play a +2 or draw!");
        return;
      }
      if (topCard === "wild_draw4" && cardId !== "wild_draw4") {
        toast.error("You must play a +4 or draw!");
        return;
      }
      if (value === "wild") {
        toast.error("You cannot change color while a draw stack is active!");
        return;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const { value } = parseCard(cardId);

    // Play colour-tinted sound
    if (value === "wild" || cardId === "wild_draw4") {
      play("cardPlayWild");
    } else {
      play("cardPlay", parseCard(cardId).color);
    }

    if (value === "wild" || cardId === "wild_draw4") {
      setPendingWildCard(cardId);
      setShowColorPicker(true);
      return;
    }

    try {
      setSelectedCard(cardId);
      await playCard({ roomId: room._id, userId: currentUserId, cardId });
      setSelectedCard(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to play card");
      setSelectedCard(null);
    }
  };

  const handleColorChoice = async (color: string) => {
    if (!pendingWildCard) return;
    setShowColorPicker(false);
    play("buttonClick");
    try {
      await playCard({
        roomId: room._id,
        userId: currentUserId,
        cardId: pendingWildCard,
        chosenColor: color,
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to play card");
    } finally {
      setPendingWildCard(null);
    }
  };

  const handleDraw = async () => {
    if (!isMyTurn) {
      toast.error("Not your turn!");
      return;
    }
    play("cardDraw");
    try {
      await drawCard({ roomId: room._id, userId: currentUserId });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to draw");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen flex flex-col overflow-hidden relative"
      style={!boardBg.src ? { background: TABLE_BG } : undefined}
    >
      {/* Background image layer */}
      {boardBg.src && (
        <img
          src={boardBg.src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ zIndex: 0 }}
        />
      )}

      {/* Overlay tint */}
      {boardBg.src && boardBg.overlay && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: boardBg.overlay, zIndex: 1 }}
        />
      )}

      {/* Felt texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
          zIndex: 2,
        }}
      />

      {/* Dynamic glow from current color */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.06, 0.12, 0.06] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 50%, ${currentGlow}, transparent)`,
          zIndex: 3,
        }}
      />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <button
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-all"
          onClick={() => router.push("/lobby")}
        >
          <ArrowLeft size={13} /> Lobby
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white tracking-wide">
            {room.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mute button */}
          <button
            onClick={toggleMute}
            className="p-2 rounded-xl border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-all"
            title={muted ? "Unmute sounds" : "Mute sounds"}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/20 bg-black/30 text-xs font-semibold text-white/70">
            🃏 <span>{game.deck.length}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
        {/* ── Opponents row ────────────────────────────────────────────────── */}
        <div className="flex justify-center gap-6 pt-4 pb-2 px-4 flex-wrap">
          {opponents.map((opp) => {
            const isTheirTurn =
              game.playerOrder[game.currentPlayerIndex] === opp.userId;
            const oppHand = opp.hand ?? [];
            return (
              <motion.div
                key={opp.userId}
                className="flex flex-col items-center gap-2"
                animate={isTheirTurn ? { scale: [1, 1.03, 1] } : {}}
                transition={{
                  duration: 1.2,
                  repeat: isTheirTurn ? Infinity : 0,
                }}
              >
                <motion.div
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border backdrop-blur-sm"
                  animate={
                    isTheirTurn
                      ? {
                          boxShadow: [
                            "0 0 0px rgba(147,51,234,0)",
                            "0 0 20px rgba(147,51,234,0.8)",
                            "0 0 0px rgba(147,51,234,0)",
                          ],
                        }
                      : {}
                  }
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{
                    background: isTheirTurn
                      ? "rgba(147,51,234,0.25)"
                      : "rgba(0,0,0,0.3)",
                    borderColor: isTheirTurn
                      ? "#9333ea"
                      : "rgba(255,255,255,0.15)",
                    color: "white",
                  }}
                >
                  {isTheirTurn && (
                    <motion.span
                      className="w-1.5 h-1.5 rounded-full bg-purple-400"
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  )}
                  {opp.isBot ? "🤖" : "👤"} {opp.name}
                  <span className="px-1.5 py-0.5 rounded-full bg-white/20 font-bold text-[10px]">
                    {oppHand.length}
                  </span>
                </motion.div>

                <div className="flex items-end" style={{ height: "3.6rem" }}>
                  {Array.from({ length: Math.min(oppHand.length, 7) }).map(
                    (_, i, arr) => {
                      const mid = (arr.length - 1) / 2;
                      const rotate = (i - mid) * 6;
                      const translateY = Math.abs(i - mid) * 2;
                      return (
                        <div
                          key={i}
                          className="-ml-3 first:ml-0"
                          style={{
                            transform: `rotate(${rotate}deg) translateY(${translateY}px)`,
                            transformOrigin: "bottom center",
                          }}
                        >
                          <CardBack size="sm" />
                        </div>
                      );
                    },
                  )}
                  {oppHand.length > 7 && (
                    <div className="w-10 h-14 -ml-3 rounded-xl flex items-center justify-center text-[10px] font-bold bg-white/10 text-white/60 border border-white/20">
                      +{oppHand.length - 7}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Center game area ──────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 py-2">
          {/* Last action log */}
          <AnimatePresence mode="wait">
            <motion.div
              key={game.lastAction ?? "start"}
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="text-xs text-center px-4 py-2 rounded-xl max-w-sm border border-white/15 bg-black/30 backdrop-blur-sm text-white/70"
            >
              {game.lastAction ?? "Game started!"}
            </motion.div>
          </AnimatePresence>

          {/* Turn indicator */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPlayerId}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-bold backdrop-blur-sm"
              style={{
                background: isMyTurn
                  ? "rgba(147,51,234,0.2)"
                  : "rgba(0,0,0,0.3)",
                borderColor: isMyTurn ? "#a855f7" : "rgba(255,255,255,0.2)",
                color: isMyTurn ? "#d8b4fe" : "rgba(255,255,255,0.7)",
                boxShadow: isMyTurn ? "0 0 24px rgba(147,51,234,0.4)" : "none",
              }}
            >
              {isMyTurn ? (
                <>
                  <motion.span
                    animate={{ rotate: [0, -10, 10, 0] }}
                    transition={{
                      duration: 0.5,
                      repeat: Infinity,
                      repeatDelay: 2,
                    }}
                  >
                    🎯
                  </motion.span>
                  Your turn!
                  <Zap size={14} className="text-purple-400" />
                </>
              ) : (
                <>⏳ {currentPlayerName}&apos;s turn</>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Color indicator & direction */}
          <div className="flex items-center gap-3">
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
                {game.currentColor}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-black/30 border border-white/15 text-xs text-white/60 backdrop-blur-sm">
              {game.direction === 1 ? "↻ CW" : "↺ CCW"}
            </div>
            {game.drawStack > 0 && (
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                className="px-3 py-1.5 rounded-xl bg-red-900/50 border border-red-500/50 text-xs font-bold text-red-300 backdrop-blur-sm"
              >
                +{game.drawStack} pending!
              </motion.div>
            )}
          </div>

          {/* ── Draw & Discard piles ──────────────────────────────────────── */}
          <div className="flex items-center gap-10">
            {/* Draw pile */}
            <div className="flex flex-col items-center gap-2">
              <motion.div
                className={isMyTurn ? "cursor-pointer" : "cursor-default"}
                whileHover={isMyTurn ? { scale: 1.07, y: -4 } : undefined}
                whileTap={isMyTurn ? { scale: 0.94 } : undefined}
                onClick={isMyTurn ? handleDraw : undefined}
                style={{
                  filter: isMyTurn
                    ? "drop-shadow(0 6px 20px rgba(139,92,246,0.6))"
                    : "drop-shadow(0 4px 10px rgba(0,0,0,0.5))",
                }}
              >
                <div className="relative">
                  <div className="absolute top-[3px] left-[2px] opacity-40">
                    <CardBack size="lg" />
                  </div>
                  <div className="absolute top-[1.5px] left-[1px] opacity-65">
                    <CardBack size="lg" />
                  </div>
                  <CardBack size="lg" />
                </div>
              </motion.div>
              <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">
                {isMyTurn ? "Draw" : "Deck"}
              </span>
            </div>

            {/* Discard pile */}
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
                    transition={{
                      type: "spring",
                      stiffness: 320,
                      damping: 24,
                    }}
                    style={{
                      filter: `drop-shadow(0 8px 24px ${currentGlow})`,
                    }}
                  >
                    <UnoCard cardId={topCard} size="lg" index={0} />
                  </motion.div>
                </AnimatePresence>
              </div>
              <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">
                Discard
              </span>
            </div>
          </div>
        </div>

        {/* ── Player's hand ─────────────────────────────────────────────────── */}
        <div
          className="relative border-t border-white/10 bg-black/40 backdrop-blur-md px-4 pt-3 pb-4"
          style={{ boxShadow: "0 -8px 32px rgba(0,0,0,0.5)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
              Your Hand ({playerHand?.length ?? 0})
            </span>
            <AnimatePresence>
              {playerHand?.length === 1 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  className="px-3 py-1 rounded-full font-black text-xs tracking-widest"
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
            </AnimatePresence>
          </div>

          {/* Cards fan */}
          <div className="flex flex-wrap justify-center gap-1.5 max-h-44 overflow-y-auto pb-1">
            {playerHand?.map((cardId, i) => {
              // ── Uses isCardPlayable which respects the draw stack ──────────
              const playable =
                isMyTurn &&
                isCardPlayable(
                  cardId,
                  topCard,
                  game.currentColor,
                  game.drawStack,
                );
              return (
                <UnoCard
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

          {/* Draw stack warning */}
          {isMyTurn && game.drawStack > 0 && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-xs text-red-400 mt-2 font-semibold"
            >
              Play a matching +2 or +4, or draw {game.drawStack} cards!
            </motion.p>
          )}
        </div>
      </div>

      {/* ── Wild color picker modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showColorPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(8px)",
            }}
          >
            <motion.div
              initial={{ scale: 0.7, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.7, y: 30, opacity: 0 }}
              transition={{ type: "spring", stiffness: 360, damping: 26 }}
              className="p-7 rounded-3xl border border-white/20 text-center"
              style={{
                background:
                  "linear-gradient(145deg, rgba(30,15,60,0.97) 0%, rgba(15,10,40,0.97) 100%)",
                boxShadow:
                  "0 30px 80px rgba(0,0,0,0.8), 0 0 60px rgba(139,92,246,0.3)",
              }}
            >
              <h3 className="font-black text-2xl mb-1 text-white tracking-tight">
                Choose a Color
              </h3>
              <p className="text-white/40 text-xs mb-5 uppercase tracking-widest">
                Wild card played
              </p>
              <div className="grid grid-cols-2 gap-3">
                {COLOR_OPTIONS.map((color) => (
                  <motion.button
                    key={color}
                    whileHover={{ scale: 1.06, y: -2 }}
                    whileTap={{ scale: 0.94 }}
                    className="w-28 h-24 rounded-2xl capitalize font-black text-white text-lg relative overflow-hidden"
                    style={{
                      background:
                        color === "red"
                          ? "linear-gradient(145deg, #ff2d2d, #8b0000)"
                          : color === "blue"
                            ? "linear-gradient(145deg, #2d8bff, #001e8b)"
                            : color === "green"
                              ? "linear-gradient(145deg, #1fc95b, #005220)"
                              : "linear-gradient(145deg, #ffe835, #9b6f00)",
                      boxShadow: `0 6px 24px ${COLOR_GLOW[color]}`,
                      textShadow: "0 2px 6px rgba(0,0,0,0.5)",
                    }}
                    onClick={() => handleColorChoice(color)}
                  >
                    <div
                      className="absolute inset-0 top-0 h-1/2 rounded-t-2xl"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)",
                      }}
                    />
                    {color}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
