"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { WaitingRoom } from "@/app/components/WaitingRoom";
import { useSoundManager } from "@/hooks/useSoundManager";
import { GameBoard } from "../components/Gameboard";

// ─── Local types matching the new schema ─────────────────────────────────────

interface Room {
  _id: Id<"rooms">;
  name: string;
  hostId: string;
  hostName: string;
  status: "waiting" | "playing" | "finished";
  maxPlayers: number;
  playerIds: string[];
  startingLives: number;
  createdAt: number;
}

interface Player {
  _id: Id<"players">;
  userId: string;
  name: string;
  avatarUrl?: string;
  isBot: boolean;
  isReady: boolean;
  isConnected: boolean;
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

type Stage = "creating" | "ready" | "error";

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlayPage() {
  const { user, isLoaded } = useUser();
  const router     = useRouter();
  const createRoom = useMutation(api.rooms.createRoom);
  const addBot     = useMutation(api.rooms.addBot);
  const startGame  = useMutation(api.game.startGame);
  const leaveRoom  = useMutation(api.rooms.leaveRoom);

  const [roomId, setRoomId]     = useState<Id<"rooms"> | null>(null);
  const [stage, setStage]       = useState<Stage>("creating");
  const [errorMsg, setErrorMsg] = useState("");
  const didRun     = useRef(false);
  const prevStatus = useRef<string>("active");

  const { play } = useSoundManager();

  const roomRaw    = useQuery(api.rooms.getRoom,        roomId ? { roomId } : "skip");
  const playersRaw = useQuery(api.rooms.getRoomPlayers, roomId ? { roomId } : "skip");
  const gameRaw    = useQuery(api.game.getGame,         roomId ? { roomId } : "skip");

  // Cast to our typed interfaces (Convex returns slightly wider inferred types)
  const room    = roomRaw    as Room    | null | undefined;
  const players = playersRaw as Player[] | undefined;
  const game    = gameRaw    as Game    | null | undefined;

  // ── Auto-create room vs bot on mount ──────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !user || didRun.current) return;
    didRun.current = true;

    async function setup() {
      try {
        const newRoomId = await createRoom({
          name: `${user!.firstName ?? "Player"}'s Table`,
          hostId: user!.id,
          hostName: user!.firstName ?? user!.username ?? "Player",
          avatarUrl: user!.imageUrl,
          maxPlayers: 2,
          startingLives: 5,
        });
        await addBot({ roomId: newRoomId, requesterId: user!.id });
        await startGame({ roomId: newRoomId, requesterId: user!.id });
        setRoomId(newRoomId);
        setStage("ready");
      } catch (e: unknown) {
        setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
        setStage("error");
      }
    }

    setup();
  }, [isLoaded, user, createRoom, addBot, startGame]);

  // ── Play win/lose sound when hand finishes ────────────────────────────────
  useEffect(() => {
    if (!game || !user) return;
    if (prevStatus.current !== "finished" && game.status === "finished") {
      const winnerIds = game.winnerIds ?? (game.winnerId ? [game.winnerId] : []);
      play(winnerIds.includes(user.id) ? "win" : "lose");
    }
    prevStatus.current = game.status ?? "active";
  }, [game?.status, game?.winnerId, user?.id, play]);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (isLoaded && !user) { router.push("/"); return null; }

  if (stage === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-5xl">⚠️</div>
        <p className="text-xl font-semibold text-black dark:text-white">
          Couldn&apos;t start the game
        </p>
        <p className="text-gray-500 dark:text-emerald-300 text-sm">{errorMsg}</p>
        <button
          onClick={() => { didRun.current = false; setStage("creating"); }}
          className="mt-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (stage === "creating" || !room || !players || !game || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6">
        <motion.div
          className="flex gap-3"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        >
          {["♠", "♥", "♦", "♣"].map((s, i) => (
            <motion.span
              key={i}
              className="text-4xl text-white"
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity }}
            >
              {s}
            </motion.span>
          ))}
        </motion.div>
        <p className="text-gray-500 dark:text-emerald-300 text-lg font-medium">
          Setting up your table...
        </p>
      </div>
    );
  }

  if (room.status === "playing") {
    return (
      <GameBoard
        room={room}
        game={game}
        players={players}
        currentUserId={user.id}
      />
    );
  }

  return (
    <WaitingRoom
      room={room}
      players={players}
      currentUserId={user.id}
    />
  );
}