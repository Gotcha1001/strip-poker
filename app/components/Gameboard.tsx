"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { useSoundManager } from "@/hooks/useSoundManager";

import { PokerCard } from "./PokerCard";
import { useBackground } from "../context/BackgroundContext";
import { StripWinScreen } from "./Stripwinscreen";
import { VideoLobby } from "./Videolobby";


// ─── Clothing pieces ──────────────────────────────────────────────────────────
const CLOTHING_EMOJI = ["👟", "👟", "🧦", "🧦", "👖", "👔", "👙"];

function LivesRow({ lives, max, shake = false }: { lives: number; max: number; shake?: boolean }) {
  const pieces = CLOTHING_EMOJI.slice(0, max);
  return (
    <motion.div
      className="flex gap-0.5"
      animate={shake ? { x: [-5, 5, -5, 5, 0] } : {}}
      transition={{ duration: 0.4 }}
    >
      {pieces.map((piece, i) => {
        const stillWearing = i < lives;
        return (
          <motion.span
            key={i}
            animate={{ scale: stillWearing ? 1 : 0.5, opacity: stillWearing ? 1 : 0.15 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="text-sm leading-none"
            title={stillWearing ? "Still wearing" : "Lost"}
          >
            {piece}
          </motion.span>
        );
      })}
    </motion.div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Room {
  _id: Id<"rooms">;
  name: string;
  hostId: string;
  startingLives: number;
  playerIds: string[];
}

interface Player {
  _id: Id<"players">;
  userId: string;
  name: string;
  avatarUrl?: string;
  isBot: boolean;
  lives: number;
  seatIndex: number;
}

interface Game {
  _id: Id<"games">;
  phase: "betting1" | "draw" | "betting2" | "showdown";
  currentPlayerIndex: number;
  dealerIndex: number;
  playerOrder: string[];
  playerStates: string;
  actedThisRound: string;
  drawnThisRound: string;
  lastAction?: string;
  winnerId?: string;
  winnerIds?: string[];
  loserId?: string;
  loserIds?: string[];
  winningHand?: string;
  losingHand?: string;
  status: "active" | "finished";
  handNumber: number;
  holeCards: string;
}

interface Props {
  room: Room;
  game: Game;
  players: Player[];
  currentUserId: string;
}

// ─── Phase labels ─────────────────────────────────────────────────────────────
const PHASE_LABEL: Record<string, string> = {
  betting1: "First Bet",
  draw:     "Draw Cards",
  betting2: "Final Bet",
  showdown: "Showdown",
};

const PHASE_BG: Record<string, string> = {
  betting1: "rgba(124,58,237,0.30)",
  draw:     "rgba(16,185,129,0.28)",
  betting2: "rgba(245,158,11,0.28)",
  showdown: "rgba(239,68,68,0.30)",
};

// ─── Reaction quips ───────────────────────────────────────────────────────────
const LOSE_QUIPS = [
  "💀 Off comes a piece!",
  "😳 Feeling a little breezy?",
  "🔥 Things are heating up!",
  "😂 One fewer layer of dignity...",
  "👀 Down to the wire!",
];
const WIN_QUIPS = [
  "🎉 Staying fully clothed — respect!",
  "😎 Poker face AND a wardrobe. A legend.",
  "🃏 Strip poker royalty right there.",
];

function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// ─── Component ────────────────────────────────────────────────────────────────

export function GameBoard({ room, game, players, currentUserId }: Props) {
  const router         = useRouter();
  const actionMut      = useMutation(api.game.playerAction);
  const drawMut        = useMutation(api.game.playerDraw);
  const nextHandMut    = useMutation(api.game.nextHand);
  const holeCards      = useQuery(api.game.getPlayerHoleCards, { roomId: room._id, userId: currentUserId });

  const [selectedDiscard, setSelectedDiscard] = useState<Set<number>>(new Set());
  const [actionLoading, setActionLoading]     = useState(false);
  const [reactions, setReactions]             = useState<{ id: number; text: string; x: number }[]>([]);
  const [shakeLosers, setShakeLosers]         = useState<Set<string>>(new Set());
  const [muted, setMutedState]                = useState(false);

  const { play, setMuted } = useSoundManager();
  const prevLastAction     = useRef<string | undefined>(undefined);
  const prevPhase          = useRef(game.phase);
  const { selected: bg }   = useBackground();

  // ── NEW: resolve my display name for the video tile ──────────────────────
  const myName = players.find((p) => p.userId === currentUserId)?.name ?? "Player";

  const playerStates   = JSON.parse(game.playerStates)   as Record<string, string>;
  const actedThisRound = JSON.parse(game.actedThisRound) as Record<string, boolean>;
  const drawnThisRound = JSON.parse(game.drawnThisRound) as Record<string, boolean>;

  const currentPlayerId = game.playerOrder[game.currentPlayerIndex];
  const isMyTurn        = currentPlayerId === currentUserId && game.status === "active";
  const isBotTurn       = currentPlayerId?.startsWith("bot_") && game.status === "active";
  const myState         = playerStates[currentUserId];
  const myLives         = players.find(p => p.userId === currentUserId)?.lives ?? 0;
  const opponents       = players.filter(p => p.userId !== currentUserId);

  const anyoneBet = game.playerOrder.some(
    id => playerStates[id] === "active" && actedThisRound[id] && game.lastAction?.includes("bets")
  );

  const alreadyDrawn  = drawnThisRound[currentUserId];
  const showdownCards = game.phase === "showdown"
    ? (JSON.parse(game.holeCards) as Record<string, string[]>)
    : null;

  function spawnReaction(text: string) {
    const id = Date.now() + Math.random();
    setReactions(r => [...r, { id, text, x: 15 + Math.random() * 70 }]);
    setTimeout(() => setReactions(r => r.filter(rx => rx.id !== id)), 2500);
  }

  useEffect(() => {
    const la = game.lastAction;
    if (!la || la === prevLastAction.current) return;
    prevLastAction.current = la;
    if (la.includes("loses") || la.includes("lose")) {
      spawnReaction(pickRandom(LOSE_QUIPS));
      play("lose");
      const ids = new Set([...(game.loserIds ?? []), ...(game.loserId ? [game.loserId] : [])]);
      setShakeLosers(ids);
      setTimeout(() => setShakeLosers(new Set()), 700);
    } else if (la.includes("wins") || la.includes("Wins")) {
      spawnReaction(pickRandom(WIN_QUIPS));
      play("win");
    }
  }, [game.lastAction]);

  useEffect(() => { if (isMyTurn) play("yourTurn"); }, [isMyTurn]);

  useEffect(() => {
    if (game.phase !== prevPhase.current) {
      if (game.phase === "draw") play("cardDeal");
      prevPhase.current = game.phase;
      setSelectedDiscard(new Set());
    }
  }, [game.phase]);

  const toggleMute = () => { const n = !muted; setMutedState(n); setMuted(n); };

  const toggleDiscard = (idx: number) => {
    if (!isMyTurn || game.phase !== "draw" || alreadyDrawn) return;
    setSelectedDiscard(prev => {
      const next = new Set(prev);
      if (next.has(idx)) { next.delete(idx); }
      else if (next.size < 3) { next.add(idx); }
      return next;
    });
  };

  const handleAction = async (action: "check" | "bet" | "call" | "fold") => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      play("buttonClick");
      await actionMut({ roomId: room._id, userId: currentUserId, action });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDraw = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      play("cardPlay");
      await drawMut({ roomId: room._id, userId: currentUserId, discardIndices: Array.from(selectedDiscard) });
      setSelectedDiscard(new Set());
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Draw failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleNextHand = async () => {
    try { await nextHandMut({ roomId: room._id, requesterId: currentUserId }); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  // ── Win/lose screen — shown before the main board render ─────────────────
  if (game.status === "finished" && ((game.winnerIds?.length ?? 0) > 0)) {
    const winner   = players.find(p => p.userId === game.winnerId);
    const isWinner = (game.winnerIds ?? []).includes(currentUserId);
    const isLoser  = (game.loserIds  ?? []).includes(currentUserId);
    return (
      <StripWinScreen
        winnerName={winner?.name ?? "Unknown"}
        winnerIds={game.winnerIds ?? [game.winnerId!]}
        loserIds={game.loserIds  ?? []}
        winningHand={game.winningHand ?? ""}
        losingHand={game.losingHand ?? ""}
        isWinner={isWinner}
        isLoser={isLoser}
        players={players}
        holeCardsJson={game.holeCards}
        onNextHand={handleNextHand}
        onLobby={() => router.push("/lobby")}
        handNumber={game.handNumber}
        startingLives={room.startingLives}
      />
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col overflow-hidden relative"
      style={!bg.src ? { background: "radial-gradient(ellipse at 50% 40%, #1a4a2e 0%, #0f2d1c 45%, #091a10 100%)" } : undefined}
    >
      {bg.src && (
        <div
          className="fixed inset-0"
          style={{ backgroundImage: `url(${bg.src})`, backgroundSize: "cover", backgroundPosition: "center", zIndex: 0 }}
        />
      )}
      {bg.overlay && <div className="absolute inset-0" style={{ background: bg.overlay, zIndex: 0 }} />}

      {/* Felt noise */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
          zIndex: 0,
        }}
      />

      {/* Floating quips */}
      <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
        <AnimatePresence>
          {reactions.map(r => (
            <motion.div
              key={r.id}
              initial={{ y: "85%", opacity: 0, scale: 0.8 }}
              animate={{ y: "15%", opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.6, ease: "easeOut" }}
              className="absolute px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-full text-white text-xs font-semibold border border-white/20 whitespace-nowrap"
              style={{ left: `${r.x}%` }}
            >
              {r.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Header ── */}
      <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <button
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-all"
          onClick={() => router.push("/lobby")}
        >
          <ArrowLeft size={13} /> Lobby
        </button>
        <div className="flex flex-col items-center">
          <span className="text-sm font-bold text-white">🎰 {room.name}</span>
          <span className="text-[10px] text-white/40">Hand #{game.handNumber}</span>
        </div>
        <button
          onClick={toggleMute}
          className="p-2 rounded-xl border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-all"
        >
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
      </header>

      {/*
       * ── NEW: Video panel ─────────────────────────────────────────────────
       * Sits between the header and the game content. z-20 keeps it above
       * the felt texture (z-0) but below the floating quips (z-50).
       * defaultCollapsed={true} so it starts as a slim bar — players open
       * it when they want without it blocking their cards.
       */}
      <div className="relative z-20 px-4 pt-2">
        <VideoLobby
          roomId={String(room._id)}
          userId={currentUserId}
          userName={myName}
          defaultCollapsed={true}
        />
      </div>
      {/* ── END NEW ── */}

      <div className="flex-1 flex flex-col relative z-10 overflow-hidden">

        {/* Phase badge */}
        <div className="flex justify-center pt-2 pb-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={game.phase}
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
              className="px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest"
              style={{
                background: PHASE_BG[game.phase] ?? "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {PHASE_LABEL[game.phase] ?? game.phase}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Opponents */}
        <div className="flex justify-center gap-4 pt-3 pb-1 px-4 flex-wrap">
          {opponents.map(opp => {
            const isTheirTurn = currentPlayerId === opp.userId && game.status === "active";
            const oppState    = playerStates[opp.userId];
            const oppCards    = showdownCards?.[opp.userId];
            const isShaking   = shakeLosers.has(opp.userId);

            return (
              <motion.div
                key={opp.userId}
                className="flex flex-col items-center gap-1.5"
                animate={isTheirTurn ? { scale: [1, 1.03, 1] } : {}}
                transition={{ duration: 1.2, repeat: isTheirTurn ? Infinity : 0 }}
              >
                <motion.div
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border backdrop-blur-sm"
                  animate={isTheirTurn ? { boxShadow: ["0 0 0px rgba(147,51,234,0)", "0 0 20px rgba(147,51,234,0.8)", "0 0 0px rgba(147,51,234,0)"] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{
                    background: isTheirTurn ? "rgba(147,51,234,0.25)" : "rgba(0,0,0,0.35)",
                    borderColor: isTheirTurn ? "#9333ea" : "rgba(255,255,255,0.15)",
                    color: "white",
                  }}
                >
                  {isTheirTurn && (
                    <motion.span
                      className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0"
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  )}
                  {opp.isBot ? "🤖" : "👤"} {opp.name}
                  {oppState === "folded" && (
                    <span className="text-[9px] text-gray-400 bg-gray-800/50 px-1.5 rounded">FOLD</span>
                  )}
                  {game.phase === "draw" && drawnThisRound[opp.userId] && (
                    <span className="text-[9px] text-emerald-400 bg-emerald-900/40 px-1.5 rounded">DRAWN</span>
                  )}
                </motion.div>

                <LivesRow lives={opp.lives} max={room.startingLives} shake={isShaking} />

                <div className="flex items-end gap-0.5" style={{ height: "3.6rem" }}>
                  {oppCards && game.phase === "showdown"
                    ? oppCards.map((c, i) => <PokerCard key={i} card={c} size="sm" index={i} />)
                    : [0, 1, 2, 3, 4].map(i => (
                        <div key={i} style={{ transform: `rotate(${(i - 2) * 3}deg)`, marginLeft: i > 0 ? "-8px" : 0 }}>
                          <PokerCard size="sm" faceDown index={i} />
                        </div>
                      ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Last action ticker */}
        <AnimatePresence mode="wait">
          <motion.div
            key={game.lastAction ?? "start"}
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
            className="text-xs text-center px-4 py-2 mx-4 mt-3 rounded-xl border border-white/10 bg-black/25 backdrop-blur-sm text-white/60 truncate"
          >
            {game.lastAction ?? "Game started"}
          </motion.div>
        </AnimatePresence>

        {/* Bot thinking */}
        <AnimatePresence>
          {isBotTurn && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex justify-center mt-2">
              <motion.div
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-white/50 bg-black/20 border border-white/10"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                🤖 {players.find(p => p.userId === currentPlayerId)?.name ?? "Bot"} is thinking...
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1" />

        {/* ── My hand panel ── */}
        <div
          className="relative border-t border-white/10 bg-black/40 backdrop-blur-md px-4 pt-3 pb-4"
          style={{ boxShadow: "0 -8px 32px rgba(0,0,0,0.5)" }}
        >
          {/* Turn indicator */}
          <AnimatePresence mode="wait">
            {isMyTurn ? (
              <motion.div
                key="myturn"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-2xl border text-sm font-bold mb-2"
                style={{ background: "rgba(147,51,234,0.2)", borderColor: "#a855f7", color: "#d8b4fe", boxShadow: "0 0 24px rgba(147,51,234,0.4)" }}
              >
                <motion.span animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}>🎯</motion.span>
                {game.phase === "draw" ? "Your turn — select cards to discard (0–3)" : "Your turn — bet or fold?"}
              </motion.div>
            ) : (
              <motion.div key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-center text-white/35 mb-2">
                {myState === "folded"
                  ? "😬 You folded — watching the hand play out"
                  : isBotTurn
                    ? `🤖 ${players.find(p => p.userId === currentPlayerId)?.name ?? "Bot"} is deciding...`
                    : `Waiting for ${players.find(p => p.userId === currentPlayerId)?.name ?? "player"}...`}
              </motion.div>
            )}
          </AnimatePresence>

          {/* My info row */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">Your Hand</span>
            <div className="flex items-center gap-2">
              <LivesRow lives={myLives} max={room.startingLives} shake={shakeLosers.has(currentUserId)} />
              <span className="text-[10px] text-white/30">{myLives} left</span>
            </div>
          </div>

          {/* My 5 cards */}
          <div className="flex justify-center gap-2 mb-3">
            {holeCards
              ? holeCards.map((c, i) => {
                  const isSelected  = selectedDiscard.has(i);
                  const inDrawPhase = game.phase === "draw" && isMyTurn && !alreadyDrawn;
                  return (
                    <motion.div
                      key={i}
                      onClick={() => inDrawPhase && toggleDiscard(i)}
                      animate={{ y: isSelected ? -12 : 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      className={`relative ${inDrawPhase ? "cursor-pointer" : ""}`}
                    >
                      <PokerCard card={c} size="lg" index={i} />
                      {isSelected && (
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-black text-red-400 bg-black/80 px-1.5 py-0.5 rounded-full border border-red-500/50 whitespace-nowrap">
                          DISCARD
                        </div>
                      )}
                      {inDrawPhase && !isSelected && (
                        <div className="absolute inset-0 rounded-2xl border-2 border-white/0 hover:border-white/30 transition-all" />
                      )}
                    </motion.div>
                  );
                })
              : [0, 1, 2, 3, 4].map(i => <PokerCard key={i} faceDown size="lg" index={i} />)}
          </div>

          {/* Draw phase instruction */}
          {game.phase === "draw" && isMyTurn && !alreadyDrawn && (
            <p className="text-[10px] text-white/40 text-center mb-2">
              Tap cards to discard (max 3) • tap again to deselect • 0 selected = stand pat
            </p>
          )}

          {/* Action buttons */}
          {isMyTurn && myState !== "folded" && (
            <>
              {game.phase === "draw" && !alreadyDrawn && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDraw}
                  disabled={actionLoading}
                  className="w-full py-3 rounded-xl bg-emerald-900/60 border border-emerald-500/40 text-emerald-200 font-semibold hover:bg-emerald-900/80 disabled:opacity-40 transition-all text-sm"
                >
                  {selectedDiscard.size === 0
                    ? "🃏 Stand Pat (keep all cards)"
                    : `🔄 Draw ${selectedDiscard.size} new card${selectedDiscard.size > 1 ? "s" : ""}`}
                </motion.button>
              )}

              {(game.phase === "betting1" || game.phase === "betting2") && (
                <div className="flex gap-2">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAction("fold")}
                    disabled={actionLoading}
                    className="flex-1 py-3 rounded-xl bg-red-900/60 border border-red-500/40 text-red-200 font-semibold hover:bg-red-900/80 disabled:opacity-40 transition-all text-sm"
                  >
                    😬 Fold
                  </motion.button>

                  {anyoneBet ? (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleAction("call")}
                      disabled={actionLoading}
                      className="flex-1 py-3 rounded-xl bg-emerald-900/60 border border-emerald-500/40 text-emerald-200 font-semibold hover:bg-emerald-900/80 disabled:opacity-40 transition-all text-sm"
                    >
                      ✅ Call
                    </motion.button>
                  ) : (
                    <>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAction("check")}
                        disabled={actionLoading}
                        className="flex-1 py-3 rounded-xl bg-white/10 border border-white/25 text-white font-semibold hover:bg-white/20 disabled:opacity-40 transition-all text-sm"
                      >
                        ✋ Check
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAction("bet")}
                        disabled={actionLoading}
                        className="flex-1 py-3 rounded-xl bg-purple-900/60 border border-purple-500/40 text-purple-200 font-semibold hover:bg-purple-900/80 disabled:opacity-40 transition-all text-sm"
                      >
                        💰 Bet
                      </motion.button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}