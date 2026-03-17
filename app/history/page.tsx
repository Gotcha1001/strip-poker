"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Swords, Clock, Hash } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

interface Game {
  _id: Id<"games">;
  roomId: Id<"rooms">;
  playerOrder: string[];
  winnerId?: string;
  winnerIds?: string[];
  winningHand?: string;
  status: "active" | "finished";
  lastAction?: string;
  createdAt: number;
  communityCards: string[];
  handNumber: number;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const HAND_RANK_ORDER = [
  "Royal Flush", "Straight Flush", "Four of a Kind", "Full House",
  "Flush", "Straight", "Three of a Kind", "Two Pair", "Pair", "High Card",
  "Last player standing",
];

export default function HistoryPage() {
  const { user } = useUser();
  const router = useRouter();
  const games = useQuery(
    api.game.getFinishedGamesForUser,
    user ? { userId: user.id } : "skip"
  );

  if (!user) { router.push("/"); return null; }

  const wins = games?.filter((g) => (g.winnerIds ?? [g.winnerId]).includes(user.id)).length ?? 0;
  const losses = (games?.length ?? 0) - wins;
  const winRate = games && games.length > 0 ? Math.round((wins / games.length) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black dark:text-white">Game History</h1>
        <p className="text-gray-500 dark:text-emerald-300">Your past poker hands</p>
      </div>

      {/* Summary */}
      <motion.div
        className="grid grid-cols-3 gap-4 mb-8"
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
      >
        {[
          { label: "Total Hands", value: games?.length ?? "---", icon: Hash, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Wins", value: wins || "---", icon: Trophy, color: "text-yellow-500 dark:text-yellow-400" },
          { label: "Win Rate", value: games?.length ? `${winRate}%` : "---", icon: Swords, color: "text-teal-600 dark:text-teal-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <motion.div
            key={label}
            className="p-4 rounded-2xl border border-gray-200 dark:border-emerald-800 bg-white dark:bg-emerald-950/40 shadow-sm"
            variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
          >
            <Icon className={`h-5 w-5 mb-1 ${color}`} />
            <div className="text-2xl font-bold text-black dark:text-white">{value}</div>
            <div className="text-xs text-gray-500 dark:text-emerald-300">{label}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Game list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-emerald-300 mb-4">
          Recent Hands ({games?.length ?? 0})
        </h2>

        {games === undefined && (
          <div className="text-center py-12 text-gray-400 dark:text-emerald-400">Loading history...</div>
        )}

        {games?.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-12 text-center rounded-2xl border border-gray-200 dark:border-emerald-800 bg-white dark:bg-emerald-950/40"
          >
            <div className="text-5xl mb-4">♠</div>
            <p className="font-semibold text-black dark:text-white mb-1">No hands yet</p>
            <p className="text-gray-500 dark:text-emerald-300">Finish a game to see it here!</p>
          </motion.div>
        )}

        <AnimatePresence>
          {games?.map((game, i) => {
            const won = (game.winnerIds ?? [game.winnerId]).includes(user.id);
            const opponents = game.playerOrder.filter((id) => id !== user.id);

            return (
              <motion.div
                key={game._id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: i * 0.04 }}
                className="p-4 flex items-center gap-4 rounded-2xl border border-gray-200 dark:border-emerald-800 bg-white dark:bg-emerald-950/40 shadow-sm"
              >
                {/* Win/loss badge */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0 ${
                  won ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600" : "bg-gray-100 dark:bg-emerald-900/30 text-gray-400"
                }`}>
                  {won ? "🏆" : "😔"}
                </div>

                {/* Game info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-semibold ${won ? "text-yellow-600 dark:text-yellow-400" : "text-gray-500 dark:text-emerald-300"}`}>
                      {won ? "Victory" : "Defeat"}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-emerald-500">
                      vs {opponents.length} opponent{opponents.length !== 1 ? "s" : ""}
                    </span>
                    {game.winningHand && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                        {game.winningHand}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-emerald-400 truncate">
                    {game.lastAction ?? "Game finished"}
                  </p>
                </div>

                {/* Stats */}
                <div className="flex flex-col items-end gap-1 text-right flex-shrink-0">
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-emerald-400">
                    <Clock size={11} />
                    {timeAgo(game.createdAt)}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-emerald-500">
                    {game.communityCards.length} cards dealt
                  </div>
                  <div className="text-xs text-gray-400 dark:text-emerald-500">
                    Hand #{game.handNumber}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
