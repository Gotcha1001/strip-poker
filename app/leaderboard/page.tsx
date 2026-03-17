"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { Trophy, Medal, Swords, Hash } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

interface Game {
  _id: Id<"games">;
  playerOrder: string[];
  winnerId?: string;
  winnerIds?: string[];
  createdAt: number;
}

interface PlayerStats {
  userId: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
  streak: number;
}

function buildLeaderboard(games: Game[]): PlayerStats[] {
  const stats: Record<
    string,
    { wins: number; losses: number; recentResults: boolean[] }
  > = {};
  const sorted = [...games].sort((a, b) => a.createdAt - b.createdAt);

  for (const game of sorted) {
    for (const userId of game.playerOrder) {
      if (!stats[userId])
        stats[userId] = { wins: 0, losses: 0, recentResults: [] };
      const won = (game.winnerIds ?? [game.winnerId]).includes(userId);
      if (won) stats[userId].wins++;
      else stats[userId].losses++;
      stats[userId].recentResults.push(won);
    }
  }

  return Object.entries(stats)
    .map(([userId, s]) => {
      const total = s.wins + s.losses;
      const winRate = total > 0 ? Math.round((s.wins / total) * 100) : 0;
      let streak = 0;
      const results = s.recentResults;
      if (results.length > 0) {
        const last = results[results.length - 1];
        for (let i = results.length - 1; i >= 0; i--) {
          if (results[i] === last) streak++;
          else break;
        }
        if (!last) streak = -streak;
      }
      return { userId, wins: s.wins, losses: s.losses, total, winRate, streak };
    })
    .filter((p) => !p.userId.startsWith("bot_"))
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl">🥇</span>;
  if (rank === 2) return <span className="text-2xl">🥈</span>;
  if (rank === 3) return <span className="text-2xl">🥉</span>;
  return (
    <span className="w-8 text-center text-sm font-bold text-gray-400 dark:text-emerald-500">
      #{rank}
    </span>
  );
}

export default function LeaderboardPage() {
  const { user } = useUser();
  const games = useQuery(api.game.getFinishedGames);

  // Collect the unique human player IDs that appear in the leaderboard so we
  // can resolve their display names in one query. We pass "skip" until games
  // have loaded so we don't fire a query with an empty array.
  const leaderboard = games ? buildLeaderboard(games) : null;
  const playerIds = leaderboard ? leaderboard.map((p) => p.userId) : null;

  const usersResult = useQuery(
    api.user.getUsersByClerkIds,
    playerIds && playerIds.length > 0 ? { clerkIds: playerIds } : "skip",
  );

  // Build a quick lookup: clerkId → display name
  const nameMap: Record<string, string> = {};
  if (usersResult) {
    for (const u of usersResult) {
      nameMap[u.clerkId] = u.name;
    }
  }

  const getDisplayName = (userId: string, isMe: boolean): string => {
    if (isMe) return "You";
    return nameMap[userId] ?? `Player …${userId.slice(-6)}`;
  };

  const myRank = leaderboard?.findIndex((p) => p.userId === user?.id) ?? -1;
  const myStats = myRank >= 0 ? leaderboard![myRank] : null;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black dark:text-white flex items-center gap-2">
          <Trophy className="h-6 w-6 text-yellow-500" /> Leaderboard
        </h1>
        <p className="text-gray-500 dark:text-emerald-300">
          Top players ranked by wins
        </p>
      </div>

      {/* Your rank card */}
      {myStats && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 mb-6 rounded-2xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 flex items-center gap-4"
        >
          <RankIcon rank={myRank + 1} />
          <div className="flex-1">
            <p className="font-semibold text-emerald-700 dark:text-emerald-300 text-sm">
              Your Ranking
            </p>
            <p className="text-xs text-gray-500 dark:text-emerald-400">
              Rank #{myRank + 1} of {leaderboard!.length} players
            </p>
          </div>
          <div className="flex gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-black dark:text-white">
                {myStats.wins}
              </div>
              <div className="text-xs text-gray-500 dark:text-emerald-400">
                Wins
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-black dark:text-white">
                {myStats.winRate}%
              </div>
              <div className="text-xs text-gray-500 dark:text-emerald-400">
                Win Rate
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Leaderboard table */}
      <div className="rounded-2xl border border-gray-200 dark:border-emerald-800 bg-white dark:bg-emerald-950/40 overflow-hidden shadow-sm">
        {/* Headers */}
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-3 border-b border-gray-100 dark:border-emerald-800 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-emerald-400">
          <span>Rank</span>
          <span>Player</span>
          <span className="text-center flex items-center gap-1">
            <Trophy size={11} /> Wins
          </span>
          <span className="text-center flex items-center gap-1">
            <Hash size={11} /> Games
          </span>
          <span className="text-center flex items-center gap-1">
            <Swords size={11} /> Rate
          </span>
        </div>

        {games === undefined && (
          <div className="text-center py-12 text-gray-400 dark:text-emerald-400">
            Loading leaderboard...
          </div>
        )}

        {leaderboard?.length === 0 && (
          <div className="p-12 text-center">
            <div className="text-5xl mb-4">♠</div>
            <p className="font-semibold text-black dark:text-white mb-1">
              No data yet
            </p>
            <p className="text-gray-500 dark:text-emerald-300">
              Finish some games to populate the leaderboard!
            </p>
          </div>
        )}

        {leaderboard?.map((player, i) => {
          const isMe = player.userId === user?.id;
          const streakLabel =
            player.streak > 1
              ? `🔥 ${player.streak}W`
              : player.streak < -1
                ? `❄️ ${Math.abs(player.streak)}L`
                : null;

          return (
            <motion.div
              key={player.userId}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-3 items-center border-b border-gray-50 dark:border-emerald-900/50 last:border-0 ${
                isMe ? "bg-emerald-50 dark:bg-emerald-900/20" : ""
              }`}
            >
              <RankIcon rank={i + 1} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-medium truncate ${
                      isMe
                        ? "text-emerald-700 dark:text-emerald-300 font-semibold"
                        : "text-black dark:text-white"
                    }`}
                  >
                    {getDisplayName(player.userId, isMe)}
                  </span>
                  {isMe && (
                    <Medal
                      size={13}
                      className="text-emerald-500 flex-shrink-0"
                    />
                  )}
                  {streakLabel && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex-shrink-0">
                      {streakLabel}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 dark:text-emerald-500">
                  {player.losses} loss{player.losses !== 1 ? "es" : ""}
                </p>
              </div>
              <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400 text-center">
                {player.wins}
              </span>
              <span className="text-sm text-gray-600 dark:text-emerald-300 text-center">
                {player.total}
              </span>
              <span
                className={`text-sm font-semibold text-center ${
                  player.winRate >= 60
                    ? "text-green-600 dark:text-green-400"
                    : player.winRate >= 40
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-red-500 dark:text-red-400"
                }`}
              >
                {player.winRate}%
              </span>
            </motion.div>
          );
        })}
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-emerald-600 mt-4">
        Bots excluded · Last 100 finished games · Updates live
      </p>
    </div>
  );
}
