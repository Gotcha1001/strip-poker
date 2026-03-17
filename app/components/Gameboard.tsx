"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ArrowLeft, Volume2, VolumeX, Zap, ChevronUp } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { useSoundManager } from "@/hooks/useSoundManager";
import { WinScreen } from "./Winscreen";
import { CommunityCards, PokerCard } from "./PokerCard";
import { useBackground } from "../context/BackgroundContext";

interface Room {
  _id: Id<"rooms">;
  name: string;
  hostId: string;
  bigBlind: number;
  startingChips: number;
  playerIds: string[];
}
interface Player {
  _id: Id<"players">;
  userId: string;
  name: string;
  avatarUrl?: string;
  isBot: boolean;
  chips: number;
  seatIndex: number;
}
interface Game {
  _id: Id<"games">;
  communityCards: string[];
  pot: number;
  currentBet: number;
  minRaise: number;
  bigBlind: number;
  phase: "preflop" | "flop" | "turn" | "river" | "showdown";
  dealerIndex: number;
  currentPlayerIndex: number;
  playerOrder: string[];
  roundBets: string;
  playerStates: string;
  lastAction?: string;
  lastRaiserId?: string;
  winnerId?: string;
  winnerIds?: string[];
  winningHand?: string;
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

const TABLE_BGS: Record<string, string> = {
  felt: "radial-gradient(ellipse at 50% 40%, #1a4a2e 0%, #0f2d1c 45%, #091a10 100%)",
  blue: "radial-gradient(ellipse at 50% 40%, #1a2a5a 0%, #0f1d3c 45%, #060d1e 100%)",
  red: "radial-gradient(ellipse at 50% 40%, #5a1a1a 0%, #3c0f0f 45%, #1e0606 100%)",
  purple:
    "radial-gradient(ellipse at 50% 40%, #2a1a5a 0%, #1a0f3c 45%, #0a061e 100%)",
  charcoal:
    "radial-gradient(ellipse at 50% 40%, #2a2a2a 0%, #1a1a1a 45%, #0a0a0a 100%)",
  teal: "radial-gradient(ellipse at 50% 40%, #1a4a44 0%, #0f2c28 45%, #060f0e 100%)",
};

const PHASE_LABELS: Record<string, string> = {
  preflop: "Pre-Flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
};
const PHASE_COLORS: Record<string, string> = {
  preflop: "rgba(124,58,237,0.3)",
  flop: "rgba(16,185,129,0.25)",
  turn: "rgba(245,158,11,0.25)",
  river: "rgba(239,68,68,0.25)",
  showdown: "rgba(239,68,68,0.25)",
};

export function GameBoard({ room, game, players, currentUserId }: Props) {
  const router = useRouter();
  const playerActionMut = useMutation(api.game.playerAction);
  const nextHandMut = useMutation(api.game.nextHand);
  const holeCards = useQuery(api.game.getPlayerHoleCards, {
    roomId: room._id,
    userId: currentUserId,
  });
  const chipLedger = useQuery(api.game.getChipLedger, { roomId: room._id });

  // Read table bg from localStorage — same key the Settings page writes to
  const [tableBg, setTableBg] = useState<string>(TABLE_BGS.felt);

  const [raiseOpen, setRaiseOpen] = useState(false);
  const [raiseSlider, setRaiseSlider] = useState(0);
  const [muted, setMutedState] = useState(false);
  const { play, setMuted } = useSoundManager();
  const prevPhase = useRef(game.phase);
  const prevIsMyTurn = useRef(false);
  const prevStatus = useRef(game.status);
  const { selected: selectedBg } = useBackground();

  const roundBets = JSON.parse(game.roundBets) as Record<string, number>;
  const playerStates = JSON.parse(game.playerStates) as Record<string, string>;
  const currentPlayerId = game.playerOrder[game.currentPlayerIndex];
  const isBotTurn =
    currentPlayerId?.startsWith("bot_") && game.status === "active";
  const isMyTurn =
    currentPlayerId === currentUserId && game.status === "active";
  const myState = playerStates[currentUserId];
  const myChips =
    chipLedger?.find((l) => l.userId === currentUserId)?.chips ?? 0;
  const myBet = roundBets[currentUserId] ?? 0;
  const callAmt = Math.min(game.currentBet - myBet, myChips);
  const canCheck = callAmt <= 0;
  const n = game.playerOrder.length;
  const dealerPlayerId = game.playerOrder[game.dealerIndex];
  const sbPlayerId = game.playerOrder[(game.dealerIndex + 1) % n];
  const bbPlayerId = game.playerOrder[(game.dealerIndex + 2) % n];
  const opponents = players.filter((p) => p.userId !== currentUserId);
  const showdownHoleCards =
    game.phase === "showdown"
      ? (JSON.parse(game.holeCards) as Record<string, string[]>)
      : null;
  const minRaiseTotal = game.currentBet + game.minRaise;
  const maxRaiseTotal = myChips + myBet;
  const raiseAmt = Math.max(
    minRaiseTotal,
    Math.min(raiseSlider || minRaiseTotal, maxRaiseTotal),
  );

  useEffect(() => {
    if (isMyTurn && !prevIsMyTurn.current) play("yourTurn");
    prevIsMyTurn.current = isMyTurn;
  }, [isMyTurn, play]);

  useEffect(() => {
    if (game.phase !== prevPhase.current) {
      if (["flop", "turn", "river"].includes(game.phase)) play("cardDeal");
      prevPhase.current = game.phase;
    }
  }, [game.phase, play]);

  useEffect(() => {
    if (prevStatus.current === "active" && game.status === "finished") {
      const ids = game.winnerIds ?? (game.winnerId ? [game.winnerId] : []);
      play(ids.includes(currentUserId) ? "win" : "lose");
      prevStatus.current = game.status;
    }
  }, [game.status, game.winnerId, game.winnerIds, currentUserId, play]);

  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
  };

  const doAction = async (
    action: "fold" | "check" | "call" | "raise" | "allIn",
    amount?: number,
  ) => {
    try {
      play("buttonClick");
      await playerActionMut({
        roomId: room._id,
        userId: currentUserId,
        action,
        raiseAmount: amount,
      });
      setRaiseOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  const handleNextHand = async () => {
    try {
      await nextHandMut({ roomId: room._id, requesterId: currentUserId });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (game.status === "finished" && game.winnerId) {
    const winner = players.find((p) => p.userId === game.winnerId);
    const isWinner =
      game.winnerId === currentUserId ||
      (game.winnerIds ?? []).includes(currentUserId);
    return (
      <WinScreen
        winnerName={winner?.name ?? "Unknown"}
        winnerIds={game.winnerIds ?? [game.winnerId]}
        winningHand={game.winningHand ?? ""}
        pot={game.pot}
        isWinner={isWinner}
        players={players}
        chipLedger={chipLedger ?? []}
        holeCardsJson={game.holeCards}
        communityCards={game.communityCards}
        onNextHand={handleNextHand}
        onLobby={() => router.push("/lobby")}
        handNumber={game.handNumber}
      />
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col overflow-hidden relative"
      style={
        !selectedBg.src
          ? {
              background:
                "radial-gradient(ellipse at 50% 40%, #1a4a2e 0%, #0f2d1c 45%, #091a10 100%)",
            }
          : undefined
      }
    >
      {/* Background image (for non-CSS backgrounds) */}
      {selectedBg.src && (
        <div
          className="fixed inset-0"
          style={{
            backgroundImage: `url(${selectedBg.src})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            zIndex: 0,
          }}
        />
      )}
      {/* Overlay tint */}
      {selectedBg.overlay && (
        <div
          className="absolute inset-0"
          style={{ background: selectedBg.overlay, zIndex: 0 }}
        />
      )}
      {/* Noise texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
          zIndex: 0,
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <button
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-all"
          onClick={() => router.push("/lobby")}
        >
          <ArrowLeft size={13} /> Lobby
        </button>
        <div className="flex flex-col items-center">
          <span className="text-sm font-bold text-white">{room.name}</span>
          <span className="text-[10px] text-white/40">
            Hand #{game.handNumber}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="p-2 rounded-xl border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-all"
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/20 bg-black/30 text-xs font-semibold text-amber-400">
            Pot: {game.pot}
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
        <div className="flex justify-center pt-2 pb-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={game.phase}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest"
              style={{
                background: PHASE_COLORS[game.phase] ?? "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.8)",
              }}
            >
              {PHASE_LABELS[game.phase] ?? game.phase}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex justify-center gap-3 pt-2 pb-1 px-4 flex-wrap">
          {opponents.map((opp) => {
            const isTheirTurn =
              currentPlayerId === opp.userId && game.status === "active";
            const oppState = playerStates[opp.userId];
            const oppBet = roundBets[opp.userId] ?? 0;
            const oppChips =
              chipLedger?.find((l) => l.userId === opp.userId)?.chips ??
              opp.chips;
            const oppCards = showdownHoleCards?.[opp.userId];
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
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border backdrop-blur-sm"
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
                      className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0"
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  )}
                  {opp.isBot ? "🤖" : "👤"} {opp.name}
                  {dealerPlayerId === opp.userId && (
                    <span className="w-4 h-4 rounded-full bg-amber-400 text-black text-[8px] font-black flex items-center justify-center flex-shrink-0">
                      D
                    </span>
                  )}
                  {sbPlayerId === opp.userId && (
                    <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[7px] font-black flex items-center justify-center flex-shrink-0">
                      SB
                    </span>
                  )}
                  {bbPlayerId === opp.userId && (
                    <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[7px] font-black flex items-center justify-center flex-shrink-0">
                      BB
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 rounded-full bg-white/20 font-bold text-[10px]">
                    {oppChips}
                  </span>
                  {oppState === "folded" && (
                    <span className="text-[9px] text-gray-400 bg-gray-800/50 px-1.5 rounded">
                      FOLD
                    </span>
                  )}
                  {oppState === "allIn" && (
                    <span className="text-[9px] text-red-300 bg-red-900/40 px-1.5 rounded">
                      ALL IN
                    </span>
                  )}
                </motion.div>
                <div
                  className="flex items-end gap-1"
                  style={{ height: "3.6rem" }}
                >
                  {oppCards && game.phase === "showdown"
                    ? oppCards.map((c, i) => (
                        <PokerCard key={i} card={c} size="sm" index={i} />
                      ))
                    : [0, 1].map((i) => (
                        <div
                          key={i}
                          className="-ml-2 first:ml-0"
                          style={{ transform: `rotate(${(i - 0.5) * 6}deg)` }}
                        >
                          <PokerCard size="sm" faceDown index={i} />
                        </div>
                      ))}
                </div>
                {oppBet > 0 && (
                  <div className="text-[10px] text-green-300 font-semibold">
                    Bet: {oppBet}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-2 py-3">
          <span className="text-[10px] text-white/35 uppercase tracking-widest">
            Community Cards
          </span>
          <CommunityCards cards={game.communityCards} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={game.lastAction ?? "start"}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="text-xs text-center px-4 py-2 mx-4 rounded-xl border border-white/10 bg-black/25 backdrop-blur-sm text-white/60 truncate"
          >
            {game.lastAction ?? "Game started"}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {isBotTurn && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex justify-center mt-2"
            >
              <motion.div
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-white/50 bg-black/20 border border-white/10"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                🤖{" "}
                {players.find((p) => p.userId === currentPlayerId)?.name ??
                  "Bot"}{" "}
                is thinking...
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1" />

        <div
          className="relative border-t border-white/10 bg-black/40 backdrop-blur-md px-4 pt-3 pb-4"
          style={{ boxShadow: "0 -8px 32px rgba(0,0,0,0.5)" }}
        >
          <AnimatePresence mode="wait">
            {isMyTurn ? (
              <motion.div
                key="myturn"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-2xl border text-sm font-bold mb-2"
                style={{
                  background: "rgba(147,51,234,0.2)",
                  borderColor: "#a855f7",
                  color: "#d8b4fe",
                  boxShadow: "0 0 24px rgba(147,51,234,0.4)",
                }}
              >
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
                Your turn! <Zap size={14} className="text-purple-400" />
              </motion.div>
            ) : (
              <motion.div
                key="wait"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs text-center text-white/35 mb-2"
              >
                {myState === "folded"
                  ? "You folded — watching the hand play out"
                  : myState === "allIn"
                    ? "🚀 You are all-in — waiting for outcome"
                    : isBotTurn
                      ? `🤖 ${players.find((p) => p.userId === currentPlayerId)?.name ?? "Bot"} is deciding...`
                      : `Waiting for ${players.find((p) => p.userId === currentPlayerId)?.name ?? "player"}...`}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">
                Your Hand
              </span>
              {dealerPlayerId === currentUserId && (
                <span className="w-4 h-4 rounded-full bg-amber-400 text-black text-[8px] font-black flex items-center justify-center">
                  D
                </span>
              )}
              {sbPlayerId === currentUserId && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/30 text-blue-300">
                  SB {Math.floor(room.bigBlind / 2)}
                </span>
              )}
              {bbPlayerId === currentUserId && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/30 text-red-300">
                  BB {room.bigBlind}
                </span>
              )}
            </div>
            <div className="text-xs text-white/50">
              Chips: <span className="text-amber-300 font-bold">{myChips}</span>
              {myBet > 0 && (
                <span className="text-green-300 ml-2">Bet: {myBet}</span>
              )}
            </div>
          </div>

          <div className="flex justify-center gap-4 mb-3">
            {holeCards
              ? holeCards.map((c, i) => (
                  <PokerCard key={i} card={c} size="xl" index={i} />
                ))
              : [0, 1].map((i) => (
                  <PokerCard key={i} faceDown size="xl" index={i} />
                ))}
          </div>

          {isMyTurn && myState !== "folded" && myState !== "allIn" && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 justify-center flex-wrap">
                <button
                  onClick={() => doAction("fold")}
                  className="px-4 py-2 rounded-xl bg-red-900/60 border border-red-500/40 text-red-200 text-sm font-semibold hover:bg-red-900/80 active:scale-95 transition-all"
                >
                  Fold
                </button>
                {canCheck ? (
                  <button
                    onClick={() => doAction("check")}
                    className="px-4 py-2 rounded-xl bg-white/10 border border-white/25 text-white text-sm font-semibold hover:bg-white/20 active:scale-95 transition-all"
                  >
                    Check
                  </button>
                ) : (
                  <button
                    onClick={() => doAction("call")}
                    className="px-4 py-2 rounded-xl bg-emerald-900/60 border border-emerald-500/40 text-emerald-200 text-sm font-semibold hover:bg-emerald-900/80 active:scale-95 transition-all"
                  >
                    Call {callAmt}
                  </button>
                )}
                {myChips > callAmt ? (
                  <button
                    onClick={() => setRaiseOpen((v) => !v)}
                    className="px-4 py-2 rounded-xl bg-purple-900/60 border border-purple-500/40 text-purple-200 text-sm font-semibold hover:bg-purple-900/80 active:scale-95 transition-all flex items-center gap-1"
                  >
                    Raise{" "}
                    <ChevronUp
                      size={13}
                      className={
                        raiseOpen
                          ? "rotate-180 transition-transform"
                          : "transition-transform"
                      }
                    />
                  </button>
                ) : (
                  myChips > 0 && (
                    <button
                      onClick={() => doAction("allIn")}
                      className="px-4 py-2 rounded-xl bg-amber-900/60 border border-amber-500/40 text-amber-200 text-sm font-semibold hover:bg-amber-900/80 active:scale-95 transition-all"
                    >
                      All In {myChips}
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
                      step={game.bigBlind}
                      value={raiseAmt}
                      onChange={(e) => setRaiseSlider(+e.target.value)}
                      className="flex-1 max-w-[140px] accent-purple-500"
                    />
                    <span className="text-white font-bold text-sm min-w-[40px]">
                      {raiseAmt}
                    </span>
                    <button
                      onClick={() => doAction("raise", raiseAmt)}
                      className="px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-500 active:scale-95 transition-all"
                    >
                      Raise to {raiseAmt}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          {!isMyTurn && myState === "allIn" && (
            <div className="text-center py-2 text-xs text-amber-300 font-bold">
              🚀 You are ALL IN — waiting for outcome
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
