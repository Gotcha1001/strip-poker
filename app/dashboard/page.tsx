"use client";

import { useUserContext } from "../context/UserContext";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users, Gamepad2, Trophy, Clock, Swords, TrendingUp } from "lucide-react";

export default function DashboardPage() {
  const user = useUserContext();
  const { user: clerkUser } = useUser();
  const games = useQuery(
    api.game.getFinishedGamesForUser,
    clerkUser ? { userId: clerkUser.id } : "skip"
  );
  const allGames = useQuery(api.game.getFinishedGames);

  const totalGames = games?.length ?? 0;
  const wins = games?.filter((g) => (g.winnerIds ?? [g.winnerId]).includes(clerkUser?.id ?? "")).length ?? 0;
  const losses = totalGames - wins;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  const activePlayers = allGames
    ? new Set(allGames.flatMap((g) => g.playerOrder.filter((id) => !id.startsWith("bot_")))).size
    : null;

  const streak = (() => {
    if (!games || !clerkUser) return null;
    const sorted = [...games].sort((a, b) => b.createdAt - a.createdAt);
    if (sorted.length === 0) return null;
    const lastWon = (sorted[0].winnerIds ?? [sorted[0].winnerId]).includes(clerkUser.id);
    let count = 0;
    for (const g of sorted) {
      if (((g.winnerIds ?? [g.winnerId]).includes(clerkUser.id)) === lastWon) count++;
      else break;
    }
    return { won: lastWon, count };
  })();

  const isLoading = games === undefined;

  const STAT_CARDS = [
    {
      label: "Games Played",
      value: isLoading ? "..." : totalGames || "---",
      icon: Gamepad2,
      color: "text-emerald-600 dark:text-emerald-400",
      sub: totalGames > 0 ? `${wins}W / ${losses}L` : null,
    },
    {
      label: "Wins",
      value: isLoading ? "..." : wins || "---",
      icon: Trophy,
      color: "text-yellow-600 dark:text-yellow-400",
      sub: totalGames > 0 ? `${winRate}% win rate` : null,
    },
    {
      label: "Players Online",
      value: activePlayers ?? "...",
      icon: Users,
      color: "text-teal-600 dark:text-teal-400",
      sub: "in last 100 games",
    },
    {
      label: "Total Hands",
      value: isLoading ? "..." : totalGames || "---",
      icon: Clock,
      color: "text-blue-600 dark:text-blue-400",
      sub: totalGames > 0 ? `over ${totalGames} sessions` : null,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Welcome header */}
      <motion.div className="mb-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-3xl font-bold text-black dark:text-white">
          Welcome back{user?.name ? `, ${user.name}` : ""}! 👋
        </h1>
        <p className="text-gray-500 dark:text-emerald-300 mt-1">
          Ready to play? Jump into the lobby or check your stats.
        </p>
      </motion.div>

      {/* Streak banner */}
      {streak && streak.count >= 2 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`mb-6 px-5 py-3 rounded-2xl flex items-center gap-3 border ${
            streak.won
              ? "bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700"
              : "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-800"
          }`}
        >
          <span className="text-2xl">{streak.won ? "🔥" : "❄️"}</span>
          <p className="text-sm font-semibold text-black dark:text-white">
            {streak.won
              ? `You're on a ${streak.count}-hand winning streak! Keep it up.`
              : `${streak.count}-hand losing streak — time for a comeback!`}
          </p>
        </motion.div>
      )}

      {/* Stats grid */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
      >
        {STAT_CARDS.map(({ label, value, icon: Icon, color, sub }) => (
          <motion.div
            key={label}
            className="p-5 rounded-2xl border border-gray-200 dark:border-emerald-800 bg-white dark:bg-emerald-950/40 shadow-sm"
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
          >
            <Icon className={`h-6 w-6 mb-2 ${color}`} />
            <div className="text-2xl font-bold text-black dark:text-white">{value}</div>
            <div className="text-sm text-gray-500 dark:text-emerald-300">{label}</div>
            {sub && <div className="text-xs text-gray-400 dark:text-emerald-500 mt-0.5">{sub}</div>}
          </motion.div>
        ))}
      </motion.div>

      {/* Win rate bar */}
      {totalGames > 0 && (
        <motion.div
          className="p-5 rounded-2xl border border-gray-200 dark:border-emerald-800 bg-white dark:bg-emerald-950/40 shadow-sm mb-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-semibold text-black dark:text-white">Win Rate</span>
            </div>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{winRate}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-emerald-900/50 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
              initial={{ width: 0 }}
              animate={{ width: `${winRate}%` }}
              transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-gray-400 dark:text-emerald-500">
            <span>{wins} wins</span>
            <span>{losses} losses</span>
          </div>
        </motion.div>
      )}

      {/* Recent form */}
      {games && games.length > 0 && (
        <motion.div
          className="p-5 rounded-2xl border border-gray-200 dark:border-emerald-800 bg-white dark:bg-emerald-950/40 shadow-sm mb-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Swords className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-semibold text-black dark:text-white">Recent Form</span>
          </div>
          <div className="flex items-center gap-2">
            {[...games]
              .sort((a, b) => b.createdAt - a.createdAt)
              .slice(0, 10)
              .map((g, i) => {
                const won = (g.winnerIds ?? [g.winnerId]).includes(clerkUser?.id ?? "");
                return (
                  <motion.div
                    key={g._id}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.35 + i * 0.05 }}
                    title={won ? "Win" : "Loss"}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      won
                        ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                        : "bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400"
                    }`}
                  >
                    {won ? "W" : "L"}
                  </motion.div>
                );
              })}
            {games.length > 10 && (
              <span className="text-xs text-gray-400 dark:text-emerald-500 ml-1">+{games.length - 10} more</span>
            )}
          </div>
        </motion.div>
      )}

      {/* Quick actions */}
      <motion.div
        className="p-6 rounded-2xl border border-gray-200 dark:border-emerald-800 bg-white dark:bg-emerald-950/40 shadow-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <h2 className="text-lg font-semibold text-black dark:text-white mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/lobby">
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white">
              <Users className="h-4 w-4 mr-2" /> Browse Lobby
            </Button>
          </Link>
          <Link href="/play">
            <Button variant="outline" className="border-emerald-500 text-emerald-600 dark:text-emerald-400">
              <Gamepad2 className="h-4 w-4 mr-2" /> Play vs Bot
            </Button>
          </Link>
          <Link href="/local">
            <Button variant="outline" className="border-emerald-500 text-emerald-600 dark:text-emerald-400">
              🏠 Play Locally
            </Button>
          </Link>
          <Link href="/history">
            <Button variant="outline" className="border-emerald-500 text-emerald-600 dark:text-emerald-400">
              <Trophy className="h-4 w-4 mr-2" /> View History
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
