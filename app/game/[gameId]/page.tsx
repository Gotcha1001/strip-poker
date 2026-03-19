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
//   // Matches the actual folder name [gameId]
//   params: Promise<{ gameId: string }>;
// }

// export default function GamePage({ params }: Props) {
//   // Destructure gameId (folder is [gameId]) and alias it to roomId
//   // so the rest of the file stays unchanged
//   const { gameId: roomId } = use(params);
//   const { user, isLoaded } = useUser();
//   const router = useRouter();

//   // Skip queries until roomId resolves to a real string
//   const queryArg = roomId
//     ? { roomId: roomId as Id<"rooms"> }
//     : "skip" as const;

//   const room    = useQuery(api.rooms.getRoom,        queryArg);
//   const players = useQuery(api.rooms.getRoomPlayers, queryArg);
//   const game    = useQuery(api.game.getGame,         queryArg);

//   if (!isLoaded || !roomId || room === undefined || players === undefined) {
//     return (
//       <div className="min-h-screen flex flex-col items-center justify-center gap-6">
//         <motion.div
//           className="flex gap-3"
//           animate={{ opacity: [0.4, 1, 0.4] }}
//           transition={{ duration: 1.4, repeat: Infinity }}
//         >
//           {["♠", "♥", "♦", "♣"].map((s, i) => (
//             <motion.span
//               key={i}
//               className="text-4xl text-white"
//               animate={{ y: [0, -12, 0] }}
//               transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity }}
//             >
//               {s}
//             </motion.span>
//           ))}
//         </motion.div>
//         <p className="text-gray-500 dark:text-emerald-300 text-lg font-medium">
//           Loading table...
//         </p>
//       </div>
//     );
//   }

//   if (!user)  { router.push("/");      return null; }
//   if (!room)  { router.push("/lobby"); return null; }

//   if (room.status === "finished") {
//     router.push("/lobby");
//     return null;
//   }

//   if (room.status === "playing" && game) {
//     return (
//       <GameBoard
//         room={room}
//         game={game}
//         players={players}
//         currentUserId={user.id}
//       />
//     );
//   }

//   // room.status === "waiting" — host lands here after creating a room
//   return (
//     <WaitingRoom
//       room={room}
//       players={players}
//       currentUserId={user.id}
//     />
//   );
// }

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
  params: Promise<{ gameId: string }>;
}

export default function GamePage({ params }: Props) {
  const { gameId: roomId } = use(params);
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const queryArg = roomId
    ? { roomId: roomId as Id<"rooms"> }
    : ("skip" as const);

  const room = useQuery(api.rooms.getRoom, queryArg);
  const players = useQuery(api.rooms.getRoomPlayers, queryArg);
  const game = useQuery(api.game.getGame, queryArg);

  // ── Loading guard: wait for ALL three queries + auth to resolve ──
  // IMPORTANT: game must also be checked. Previously only room and players
  // were guarded, so when room.status === "playing" but game was still
  // undefined (loading), the page tried to render <GameBoard game={undefined}>,
  // causing the stuck "Loading table..." screen in production.
  if (
    !isLoaded ||
    !roomId ||
    room === undefined ||
    players === undefined ||
    game === undefined // <-- THIS WAS THE MISSING CHECK
  ) {
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
      </div>
    );
  }

  if (!user) {
    router.push("/");
    return null;
  }
  if (!room) {
    router.push("/lobby");
    return null;
  }

  if (room.status === "finished") {
    router.push("/lobby");
    return null;
  }

  if (room.status === "playing" && game) {
    return (
      <GameBoard
        room={room}
        game={game}
        players={players}
        currentUserId={user.id}
      />
    );
  }

  // room.status === "waiting" — host lands here after creating a room
  return <WaitingRoom room={room} players={players} currentUserId={user.id} />;
}
