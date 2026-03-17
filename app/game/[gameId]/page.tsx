"use client";

import { use } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { WaitingRoom } from "@/app/components/WaitingRoom";
import { GameBoard } from "@/app/components/Gameboard";


interface Props {
  params: Promise<{ roomId: string }>;
}

export default function GamePage({ params }: Props) {
  const { roomId } = use(params);
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const room = useQuery(api.rooms.getRoom, { roomId: roomId as Id<"rooms"> });
  const players = useQuery(api.rooms.getRoomPlayers, { roomId: roomId as Id<"rooms"> });
  const game = useQuery(api.game.getGame, { roomId: roomId as Id<"rooms"> });

  if (!isLoaded || room === undefined || players === undefined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6">
        <motion.div className="flex gap-3" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity }}>
          {["♠", "♥", "♦", "♣"].map((s, i) => (
            <motion.span key={i} className="text-4xl text-white"
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity }}>
              {s}
            </motion.span>
          ))}
        </motion.div>
        <p className="text-gray-500 dark:text-emerald-300 text-lg font-medium">Loading table...</p>
      </div>
    );
  }

  if (!user) { router.push("/"); return null; }
  if (!room) { router.push("/lobby"); return null; }

  if (room.status === "playing" && game) {
    return <GameBoard room={room} game={game} players={players} currentUserId={user.id} />;
  }

  return <WaitingRoom room={room} players={players} currentUserId={user.id} />;
}
