"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PokerCard } from "./PokerCard";
import { Trophy, RotateCcw } from "lucide-react";

interface Props {
  winnerName: string;
  winnerIds: string[];
  winningHand: string;
  pot: number;
  isWinner: boolean;
  players: { userId: string; name: string; isBot: boolean }[];
  chipLedger: { userId: string; chips: number; handsPlayed: number; handsWon: number }[];
  holeCardsJson: string;
  communityCards: string[];
  onNextHand: () => void;
  onLobby: () => void;
  handNumber: number;
}

export function WinScreen({
  winnerName,
  winnerIds,
  winningHand,
  pot,
  isWinner,
  players,
  chipLedger,
  holeCardsJson,
  communityCards,
  onNextHand,
  onLobby,
  handNumber,
}: Props) {
  const holeCards = JSON.parse(holeCardsJson) as Record<string, string[]>;
  const isSplit = winnerIds.length > 1;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-950 px-4 py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
        className="w-full max-w-md text-center"
      >
        {/* Icon */}
        <motion.div
          className="text-7xl mb-4"
          animate={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          {isWinner ? "🏆" : isSplit ? "🤝" : "😔"}
        </motion.div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-black text-white mb-2">
          {isSplit
            ? "Split Pot!"
            : isWinner
            ? "You Win!"
            : `${winnerName} Wins!`}
        </h1>
        <p className="text-purple-300 mb-1">
          {winningHand && <span className="text-amber-300 font-semibold">{winningHand}</span>}
          {pot > 0 && <span className="text-white/60"> — Pot of {pot}</span>}
        </p>
        <p className="text-white/40 text-sm mb-6">Hand #{handNumber}</p>

        {/* Cards reveal */}
        <div className="flex flex-wrap justify-center gap-4 mb-6">
          {players
            .filter((p) => holeCards[p.userId])
            .map((p) => {
              const isWin = winnerIds.includes(p.userId);
              return (
                <div key={p.userId} className="flex flex-col items-center gap-2">
                  <div
                    className="px-2 py-0.5 rounded text-[10px] font-semibold"
                    style={{
                      background: isWin ? "rgba(245,158,11,0.25)" : "rgba(0,0,0,0.3)",
                      color: isWin ? "#fcd34d" : "rgba(255,255,255,0.5)",
                      border: `1px solid ${isWin ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.1)"}`,
                    }}
                  >
                    {isWin ? "🏆 " : ""}
                    {p.name}
                  </div>
                  <div className="flex gap-1">
                    {holeCards[p.userId].map((c, i) => (
                      <PokerCard key={i} card={c} size="md" index={i} />
                    ))}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Community cards */}
        {communityCards.length > 0 && (
          <div className="flex flex-col items-center gap-2 mb-6">
            <span className="text-[10px] text-white/35 uppercase tracking-widest">Board</span>
            <div className="flex gap-2 flex-wrap justify-center">
              {communityCards.map((c, i) => (
                <PokerCard key={i} card={c} size="sm" index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Chip standings */}
        <div className="p-4 rounded-2xl border border-purple-800 bg-purple-950/40 mb-6 text-left">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={14} className="text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-300">
              Chip Standings
            </span>
          </div>
          <div className="space-y-2">
            {[...chipLedger]
              .sort((a, b) => b.chips - a.chips)
              .map((entry) => {
                const player = players.find((p) => p.userId === entry.userId);
                const isThisWinner = winnerIds.includes(entry.userId);
                return (
                  <div
                    key={entry.userId}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className={isThisWinner ? "text-amber-300 font-semibold" : "text-white/70"}>
                      {isThisWinner ? "🏆 " : ""}
                      {player?.name ?? entry.userId.slice(0, 8)}
                    </span>
                    <span className={`font-bold ${isThisWinner ? "text-amber-300" : "text-white/60"}`}>
                      {entry.chips}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <Button
            className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-5 text-base"
            onClick={onNextHand}
          >
            <RotateCcw size={15} className="mr-2" />
            Next Hand
          </Button>
          <Button
            variant="outline"
            className="border-purple-500 text-purple-300 hover:bg-purple-900/30 px-6 py-5 text-base"
            onClick={onLobby}
          >
            Lobby
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
