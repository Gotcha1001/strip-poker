// "use client";

// import { use } from "react";
// import { useUser } from "@clerk/nextjs";
// import { useQuery } from "convex/react";
// import { api } from "@/convex/_generated/api";
// import { Id } from "@/convex/_generated/dataModel";
// import { useRouter } from "next/navigation";
// import { motion } from "framer-motion";
// import { WaitingRoom } from "@/app/components/WaitingRoom";
// import { GameBoard } from "@/app/components/Gameboard";

// interface Props {
//   params: Promise<{ roomId: string }>;
// }

// export default function GamePage({ params }: Props) {
//   const { roomId } = use(params);
//   const { user, isLoaded } = useUser();
//   const router = useRouter();

//   // Guard: pass "skip" until the dynamic segment has actually resolved.
//   // Without this, the first render fires with roomId = "" which causes:
//   // ArgumentValidationError: Object is missing the required field `roomId`
//   const queryArg = roomId
//     ? { roomId: roomId as Id<"rooms"> }
//     : "skip" as const;

//   const room    = useQuery(api.rooms.getRoom,        queryArg);
//   const players = useQuery(api.rooms.getRoomPlayers, queryArg);
//   const game    = useQuery(api.game.getGame,         queryArg);

//   if (!isLoaded || room === undefined || players === undefined) {
//     return (
//       <div className="min-h-screen flex flex-col items-center justify-center gap-6">
//         <motion.div className="flex gap-3" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity }}>
//           {["♠", "♥", "♦", "♣"].map((s, i) => (
//             <motion.span key={i} className="text-4xl text-white"
//               animate={{ y: [0, -12, 0] }}
//               transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity }}>
//               {s}
//             </motion.span>
//           ))}
//         </motion.div>
//         <p className="text-gray-500 dark:text-emerald-300 text-lg font-medium">Loading table...</p>
//       </div>
//     );
//   }

//   if (!user) { router.push("/"); return null; }
//   if (!room) { router.push("/lobby"); return null; }

//   if (room.status === "playing" && game) {
//     return <GameBoard room={room} game={game} players={players} currentUserId={user.id} />;
//   }

//   return <WaitingRoom room={room} players={players} currentUserId={user.id} />;
// }
"use client";

import { use, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { WaitingRoom } from "@/app/components/WaitingRoom";
import { GameBoard } from "@/app/components/Gameboard";

interface Props {
  params: Promise<{ gameId: string }>;
}

export default function GamePage({ params }: Props) {
  const { gameId: roomId } = use(params);
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const renderCount = useRef(0);

  const queryArg = roomId
    ? { roomId: roomId as Id<"rooms"> }
    : ("skip" as const);

  const room = useQuery(api.rooms.getRoom, queryArg);
  const players = useQuery(api.rooms.getRoomPlayers, queryArg);
  const game = useQuery(api.game.getGame, queryArg);

  // Log every render
  renderCount.current += 1;
  console.log(`[GamePage] render #${renderCount.current}`, {
    roomId,
    isLoaded,
    userId: user?.id ?? null,
    room:
      room === undefined
        ? "LOADING"
        : room === null
          ? "NULL"
          : `status=${room.status}`,
    players: players === undefined ? "LOADING" : `count=${players.length}`,
    game:
      game === undefined
        ? "LOADING"
        : game === null
          ? "NULL"
          : `status=${game.status} phase=${game.phase}`,
  });

  // Log when each query first resolves
  const roomResolved = useRef(false);
  const playersResolved = useRef(false);
  const gameResolved = useRef(false);

  useEffect(() => {
    if (room !== undefined && !roomResolved.current) {
      roomResolved.current = true;
      console.log(
        "[GamePage] ✅ room resolved:",
        room === null
          ? "NULL (room deleted?)"
          : {
              id: room._id,
              status: room.status,
              hostId: room.hostId,
              playerCount: room.playerIds.length,
            },
      );
    }
  }, [room]);

  useEffect(() => {
    if (players !== undefined && !playersResolved.current) {
      playersResolved.current = true;
      console.log(
        "[GamePage] ✅ players resolved:",
        players.map((p) => ({ id: p.userId, name: p.name, isBot: p.isBot })),
      );
    }
  }, [players]);

  useEffect(() => {
    if (game !== undefined && !gameResolved.current) {
      gameResolved.current = true;
      console.log(
        "[GamePage] ✅ game resolved:",
        game === null
          ? "NULL (no game yet)"
          : {
              id: game._id,
              status: game.status,
              phase: game.phase,
              handNumber: game.handNumber,
            },
      );
    }
  }, [game]);

  // Warn if stuck loading after 5s
  useEffect(() => {
    const timer = setTimeout(() => {
      if (room === undefined || players === undefined || game === undefined) {
        console.error("[GamePage] ⏰ STUCK LOADING after 5s", {
          roomId,
          isLoaded,
          roomStillLoading: room === undefined,
          playersStillLoading: players === undefined,
          gameStillLoading: game === undefined,
          userSignedIn: !!user,
          convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
        });
      }
    }, 5000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Log auth changes
  useEffect(() => {
    console.log("[GamePage] auth:", { isLoaded, userId: user?.id ?? null });
  }, [isLoaded, user]);

  // ── Loading guard ──
  if (
    !isLoaded ||
    !roomId ||
    room === undefined ||
    players === undefined ||
    game === undefined
  ) {
    const pending = [
      !isLoaded && "clerk-auth",
      !roomId && "roomId",
      room === undefined && "room-query",
      players === undefined && "players-query",
      game === undefined && "game-query",
    ].filter(Boolean);

    console.log("[GamePage] 🔄 loading, pending:", pending);

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
          Loading table...
        </p>
        {/* Debug hint — remove after debugging */}
        <p className="text-xs text-white/30 font-mono mt-2">
          waiting: {pending.join(", ")}
        </p>
      </div>
    );
  }

  console.log("[GamePage] 🚀 all resolved →", {
    roomStatus: room?.status,
    gameStatus: game?.status,
    gamePhase: game?.phase,
    userInRoom: room?.playerIds.includes(user?.id ?? ""),
  });

  if (!user) {
    router.push("/");
    return null;
  }
  if (!room) {
    router.push("/lobby");
    return null;
  }

  if (room.status === "finished") {
    console.log("[GamePage] 🏁 room finished → /lobby");
    router.push("/lobby");
    return null;
  }

  if (room.status === "playing" && game) {
    console.log("[GamePage] 🎮 rendering GameBoard");
    return (
      <GameBoard
        room={room}
        game={game}
        players={players}
        currentUserId={user.id}
      />
    );
  }

  console.log("[GamePage] 🪑 rendering WaitingRoom, status=", room.status);
  return <WaitingRoom room={room} players={players} currentUserId={user.id} />;
}
