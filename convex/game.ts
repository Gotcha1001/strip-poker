// import { v } from "convex/values";
// import { mutation, query, internalMutation } from "./_generated/server";
// import { internal } from "./_generated/api";

// // ─── Deck Helpers ────────────────────────────────────────────────────────────

// const COLORS = ["red", "blue", "green", "yellow"] as const;
// const NUMBERS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
// const ACTIONS = ["skip", "reverse", "draw2"];
// const WILDS = ["wild", "wild_draw4"];

// export function createDeck(): string[] {
//   const deck: string[] = [];
//   for (const color of COLORS) {
//     deck.push(`${color}_0`);
//     for (const num of [...NUMBERS.slice(1), ...ACTIONS]) {
//       deck.push(`${color}_${num}`, `${color}_${num}`);
//     }
//   }
//   for (const wild of WILDS) {
//     for (let i = 0; i < 4; i++) deck.push(wild);
//   }
//   return shuffle(deck);
// }

// function shuffle<T>(array: T[]): T[] {
//   const arr = [...array];
//   for (let i = arr.length - 1; i > 0; i--) {
//     const j = Math.floor(Math.random() * (i + 1));
//     [arr[i], arr[j]] = [arr[j], arr[i]];
//   }
//   return arr;
// }

// export function parseCard(cardId: string): { color: string; value: string } {
//   if (cardId === "wild" || cardId === "wild_draw4")
//     return { color: "wild", value: cardId };
//   const idx = cardId.indexOf("_");
//   if (idx === -1) return { color: "wild", value: cardId };
//   return { color: cardId.slice(0, idx), value: cardId.slice(idx + 1) };
// }

// export function canPlayCard(
//   card: string,
//   topCard: string,
//   currentColor: string,
// ): boolean {
//   const { color, value } = parseCard(card);
//   const { value: topValue } = parseCard(topCard);
//   if (color === "wild") return true;
//   if (color === currentColor) return true;
//   if (value === topValue) return true;
//   return false;
// }

// // ─── Queries ─────────────────────────────────────────────────────────────────

// export const getGame = query({
//   args: { roomId: v.id("rooms") },
//   handler: async (ctx, { roomId }) => {
//     return await ctx.db
//       .query("games")
//       .withIndex("by_room", (q) => q.eq("roomId", roomId))
//       .first();
//   },
// });

// export const getPlayerHand = query({
//   args: { roomId: v.id("rooms"), userId: v.string() },
//   handler: async (ctx, { roomId, userId }) => {
//     const player = await ctx.db
//       .query("players")
//       .withIndex("by_user_room", (q) =>
//         q.eq("userId", userId).eq("roomId", roomId),
//       )
//       .first();
//     return player?.hand ?? [];
//   },
// });

// // ─── Start Game ───────────────────────────────────────────────────────────────

// export const startGame = mutation({
//   args: { roomId: v.id("rooms"), requesterId: v.string() },
//   handler: async (ctx, { roomId, requesterId }) => {
//     const room = await ctx.db.get(roomId);
//     if (!room) throw new Error("Room not found");
//     if (room.hostId !== requesterId) throw new Error("Only host can start");
//     if (room.playerIds.length < 2) throw new Error("Need at least 2 players");

//     const players = await ctx.db
//       .query("players")
//       .withIndex("by_room", (q) => q.eq("roomId", roomId))
//       .collect();

//     const sortedPlayers = players.sort((a, b) => a.seatIndex - b.seatIndex);
//     const playerOrder = sortedPlayers.map((p) => p.userId);

//     let deck = createDeck();
//     const hands: Record<string, string[]> = {};

//     for (const player of sortedPlayers) {
//       hands[player.userId] = deck.splice(0, 7);
//     }

//     let firstCard = deck.shift()!;
//     while (firstCard.startsWith("wild")) {
//       deck.push(firstCard);
//       deck = shuffle(deck);
//       firstCard = deck.shift()!;
//     }

//     const { color: firstColor } = parseCard(firstCard);

//     for (const player of sortedPlayers) {
//       await ctx.db.patch(player._id, { hand: hands[player.userId] });
//     }

//     await ctx.db.insert("games", {
//       roomId,
//       deck,
//       discardPile: [firstCard],
//       currentColor: firstColor,
//       currentPlayerIndex: 0,
//       playerOrder,
//       direction: 1,
//       drawStack: 0,
//       lastAction: `Game started! ${firstCard} is the first card`,
//       status: "active",
//       createdAt: Date.now(),
//     });

//     await ctx.db.patch(roomId, { status: "playing" });

//     const firstPlayerId = playerOrder[0];
//     if (firstPlayerId.startsWith("bot_")) {
//       await ctx.scheduler.runAfter(1500, internal.game.botTurn, { roomId });
//     }
//   },
// });

// // ─── Play Card ────────────────────────────────────────────────────────────────

// export const playCard = mutation({
//   args: {
//     roomId: v.id("rooms"),
//     userId: v.string(),
//     cardId: v.string(),
//     chosenColor: v.optional(v.string()),
//   },
//   handler: async (ctx, { roomId, userId, cardId, chosenColor }) => {
//     const game = await ctx.db
//       .query("games")
//       .withIndex("by_room", (q) => q.eq("roomId", roomId))
//       .first();

//     if (!game || game.status !== "active") throw new Error("No active game");

//     const currentPlayerId = game.playerOrder[game.currentPlayerIndex];
//     if (currentPlayerId !== userId) throw new Error("Not your turn");

//     const player = await ctx.db
//       .query("players")
//       .withIndex("by_user_room", (q) =>
//         q.eq("userId", userId).eq("roomId", roomId),
//       )
//       .first();

//     if (!player) throw new Error("Player not found");

//     const topCard = game.discardPile[game.discardPile.length - 1];
//     if (!canPlayCard(cardId, topCard, game.currentColor)) {
//       throw new Error("Cannot play that card");
//     }

//     const cardIdx = player.hand.indexOf(cardId);
//     if (cardIdx === -1) throw new Error("Card not in hand");

//     const handCopy = [...player.hand];
//     handCopy.splice(cardIdx, 1);

//     // Check for win
//     if (handCopy.length === 0) {
//       await ctx.db.patch(player._id, { hand: handCopy });
//       await ctx.db.patch(game._id, {
//         discardPile: [...game.discardPile, cardId],
//         winnerId: userId,
//         status: "finished",
//         lastAction: `🎉 ${player.name} played their last card and WINS!`,
//       });
//       await ctx.db.patch(roomId, { status: "finished" });
//       return;
//     }

//     await ctx.db.patch(player._id, { hand: handCopy });

//     const parsedCard = parseCard(cardId);
//     const newColor =
//       parsedCard.color === "wild" ? (chosenColor ?? "red") : parsedCard.color;
//     let newDirection = game.direction;
//     let nextIndex = game.currentPlayerIndex;
//     let newDrawStack = game.drawStack;
//     let lastAction = `${player.name} played ${cardId}`;
//     const numPlayers = game.playerOrder.length;

//     if (parsedCard.value === "reverse") {
//       newDirection = game.direction * -1;
//       nextIndex =
//         numPlayers === 2
//           ? (nextIndex + newDirection * 2 + numPlayers * 2) % numPlayers
//           : (nextIndex + newDirection + numPlayers) % numPlayers;
//       lastAction += " — Direction reversed!";
//     } else if (parsedCard.value === "skip") {
//       nextIndex = (nextIndex + newDirection * 2 + numPlayers * 2) % numPlayers;
//       lastAction += " — Next player skipped!";
//     } else if (parsedCard.value === "draw2") {
//       newDrawStack += 2;
//       nextIndex = (nextIndex + newDirection + numPlayers) % numPlayers;
//       lastAction += ` — Next player must draw ${newDrawStack}!`;
//     } else if (cardId === "wild_draw4") {
//       newDrawStack += 4;
//       nextIndex = (nextIndex + newDirection + numPlayers) % numPlayers;
//       lastAction += ` — Next player must draw ${newDrawStack} and color is ${newColor}!`;
//     } else {
//       nextIndex = (nextIndex + newDirection + numPlayers) % numPlayers;
//     }

//     // 🔥 NEW: Reset drawStack unless we played a penalty card
//     // This lets you "play through" a +2 with same color / number
//     if (parsedCard.value !== "draw2" && cardId !== "wild_draw4") {
//       newDrawStack = 0;
//     }

//     if (cardId === "wild") lastAction += ` — Color changed to ${newColor}!`;

//     await ctx.db.patch(game._id, {
//       discardPile: [...game.discardPile, cardId],
//       currentColor: newColor,
//       currentPlayerIndex: nextIndex,
//       direction: newDirection,
//       drawStack: newDrawStack,
//       lastAction,
//     });

//     const nextPlayerId = game.playerOrder[nextIndex];
//     if (nextPlayerId.startsWith("bot_")) {
//       await ctx.scheduler.runAfter(1500, internal.game.botTurn, { roomId });
//     }
//   },
// });

// // ─── Draw Card ────────────────────────────────────────────────────────────────

// export const drawCard = mutation({
//   args: { roomId: v.id("rooms"), userId: v.string() },
//   handler: async (ctx, { roomId, userId }) => {
//     const game = await ctx.db
//       .query("games")
//       .withIndex("by_room", (q) => q.eq("roomId", roomId))
//       .first();

//     if (!game || game.status !== "active") throw new Error("No active game");

//     const currentPlayerId = game.playerOrder[game.currentPlayerIndex];
//     if (currentPlayerId !== userId) throw new Error("Not your turn");

//     const player = await ctx.db
//       .query("players")
//       .withIndex("by_user_room", (q) =>
//         q.eq("userId", userId).eq("roomId", roomId),
//       )
//       .first();

//     if (!player) throw new Error("Player not found");

//     let deck = [...game.deck];
//     let discardPile = [...game.discardPile];
//     const drawCount = game.drawStack > 0 ? game.drawStack : 1;

//     if (deck.length < drawCount) {
//       const topCard = discardPile.pop()!;
//       deck = [...deck, ...shuffle(discardPile)];
//       discardPile = [topCard];
//     }

//     const drawnCards = deck.splice(0, drawCount);
//     const newHand = [...player.hand, ...drawnCards];

//     await ctx.db.patch(player._id, { hand: newHand });

//     const numPlayers = game.playerOrder.length;
//     const nextIndex =
//       (game.currentPlayerIndex + game.direction + numPlayers) % numPlayers;

//     await ctx.db.patch(game._id, {
//       deck,
//       discardPile,
//       drawStack: 0,
//       currentPlayerIndex: nextIndex,
//       lastAction: `${player.name} drew ${drawCount} card${drawCount > 1 ? "s" : ""}`,
//     });

//     const nextPlayerId = game.playerOrder[nextIndex];
//     if (nextPlayerId.startsWith("bot_")) {
//       await ctx.scheduler.runAfter(1500, internal.game.botTurn, { roomId });
//     }
//   },
// });

// // ─── Bot Turn (Internal) ──────────────────────────────────────────────────────

// // ─── Bot Turn (Internal) ──────────────────────────────────────────────────────
// export const botTurn = internalMutation({
//   args: { roomId: v.id("rooms") },
//   handler: async (ctx, { roomId }) => {
//     const game = await ctx.db
//       .query("games")
//       .withIndex("by_room", (q) => q.eq("roomId", roomId))
//       .first();

//     if (!game || game.status !== "active") return;

//     const botId = game.playerOrder[game.currentPlayerIndex];
//     if (!botId.startsWith("bot_")) return;

//     const bot = await ctx.db
//       .query("players")
//       .withIndex("by_user_room", (q) =>
//         q.eq("userId", botId).eq("roomId", roomId),
//       )
//       .first();

//     if (!bot) return;

//     const topCard = game.discardPile[game.discardPile.length - 1];
//     const drawStack = game.drawStack;

//     const isPenaltyStackTurn = drawStack > 0;
//     const topParsed = parseCard(topCard);

//     const playable = bot.hand.filter((card) => {
//       if (!canPlayCard(card, topCard, game.currentColor)) return false;

//       if (!isPenaltyStackTurn) return true;

//       const cardParsed = parseCard(card);

//       if (topParsed.value === "draw2") {
//         return cardParsed.value === "draw2";
//       }

//       if (topCard === "wild_draw4") {
//         return card === "wild_draw4";
//       }

//       return false;
//     });

//     if (playable.length > 0) {
//       const card =
//         playable.find((c) => parseCard(c).value.includes("draw")) ??
//         playable.find((c) =>
//           ["skip", "reverse"].includes(parseCard(c).value),
//         ) ??
//         playable[0];

//       const { color } = parseCard(card);
//       const chosenColor =
//         color === "wild"
//           ? (COLORS[Math.floor(Math.random() * 4)] as string)
//           : color;

//       const handCopy = [...bot.hand];
//       handCopy.splice(handCopy.indexOf(card), 1);

//       if (handCopy.length === 0) {
//         await ctx.db.patch(bot._id, { hand: handCopy });
//         await ctx.db.patch(game._id, {
//           discardPile: [...game.discardPile, card],
//           winnerId: botId,
//           status: "finished",
//           lastAction: `🤖 ${bot.name} wins!`,
//         });
//         await ctx.db.patch(roomId, { status: "finished" });
//         return;
//       }

//       await ctx.db.patch(bot._id, { hand: handCopy });

//       const parsedCard = parseCard(card);
//       const newColor =
//         parsedCard.color === "wild" ? chosenColor : parsedCard.color;
//       let newDirection = game.direction;
//       let nextIndex = game.currentPlayerIndex;
//       let newDrawStack = game.drawStack;
//       const numPlayers = game.playerOrder.length;
//       let lastAction = `🤖 ${bot.name} played ${card}`;

//       if (parsedCard.value === "reverse") {
//         newDirection *= -1;
//         nextIndex =
//           numPlayers === 2
//             ? (nextIndex + newDirection * 2 + numPlayers * 2) % numPlayers
//             : (nextIndex + newDirection + numPlayers) % numPlayers;
//         lastAction += " — Direction reversed!";
//       } else if (parsedCard.value === "skip") {
//         nextIndex =
//           (nextIndex + newDirection * 2 + numPlayers * 2) % numPlayers;
//         lastAction += " — Next player skipped!";
//       } else if (parsedCard.value === "draw2") {
//         newDrawStack += 2;
//         nextIndex = (nextIndex + newDirection + numPlayers) % numPlayers;
//         lastAction += ` — Next player must draw ${newDrawStack}!`;
//       } else if (card === "wild_draw4") {
//         newDrawStack += 4;
//         nextIndex = (nextIndex + newDirection + numPlayers) % numPlayers;
//         lastAction += ` — Next player must draw ${newDrawStack} and color is ${newColor}!`;
//       } else {
//         nextIndex = (nextIndex + newDirection + numPlayers) % numPlayers;
//       }

//       // ─── IMPORTANT FIX ───────────────────────────────────────
//       // Reset drawStack when bot plays a non-penalty card (same as human)
//       if (parsedCard.value !== "draw2" && card !== "wild_draw4") {
//         newDrawStack = 0;
//       }
//       // ──────────────────────────────────────────────────────────

//       if (card === "wild") lastAction += ` — Color changed to ${newColor}!`;

//       await ctx.db.patch(game._id, {
//         discardPile: [...game.discardPile, card],
//         currentColor: newColor,
//         currentPlayerIndex: nextIndex,
//         direction: newDirection,
//         drawStack: newDrawStack,
//         lastAction,
//       });

//       const nextPlayerId = game.playerOrder[nextIndex];
//       if (nextPlayerId.startsWith("bot_")) {
//         await ctx.scheduler.runAfter(1500, internal.game.botTurn, { roomId });
//       }
//     } else {
//       // draw logic remains unchanged
//       let deck = [...game.deck];
//       let discardPile = [...game.discardPile];
//       const drawCount = drawStack > 0 ? drawStack : 1;

//       if (deck.length < drawCount) {
//         const topCard = discardPile.pop()!;
//         deck = [...deck, ...shuffle(discardPile)];
//         discardPile = [topCard];
//       }

//       const drawnCards = deck.splice(0, drawCount);
//       await ctx.db.patch(bot._id, { hand: [...bot.hand, ...drawnCards] });

//       const numPlayers = game.playerOrder.length;
//       const nextIndex =
//         (game.currentPlayerIndex + game.direction + numPlayers) % numPlayers;

//       await ctx.db.patch(game._id, {
//         deck,
//         discardPile,
//         drawStack: 0,
//         currentPlayerIndex: nextIndex,
//         lastAction: `🤖 ${bot.name} drew ${drawCount} card${drawCount > 1 ? "s" : ""}`,
//       });

//       const nextPlayerId = game.playerOrder[nextIndex];
//       if (nextPlayerId.startsWith("bot_")) {
//         await ctx.scheduler.runAfter(1500, internal.game.botTurn, { roomId });
//       }
//     }
//   },
// });

// // ─── Game History ─────────────────────────────────────────────────────────────

// export const getFinishedGames = query({
//   handler: async (ctx) => {
//     return await ctx.db
//       .query("games")
//       .filter((q) => q.eq(q.field("status"), "finished"))
//       .order("desc")
//       .take(50);
//   },
// });

// export const getFinishedGamesForUser = query({
//   args: { userId: v.string() },
//   handler: async (ctx, { userId }) => {
//     const allFinished = await ctx.db
//       .query("games")
//       .filter((q) => q.eq(q.field("status"), "finished"))
//       .order("desc")
//       .take(200);

//     return allFinished.filter((game) => game.playerOrder.includes(userId));
//   },
// });

import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// ─── Deck Helpers ────────────────────────────────────────────────────────────

const COLORS = ["red", "blue", "green", "yellow"] as const;
const NUMBERS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const ACTIONS = ["skip", "reverse", "draw2"];
const WILDS = ["wild", "wild_draw4"];

export function createDeck(): string[] {
  const deck: string[] = [];
  for (const color of COLORS) {
    deck.push(`${color}_0`);
    for (const num of [...NUMBERS.slice(1), ...ACTIONS]) {
      deck.push(`${color}_${num}`, `${color}_${num}`);
    }
  }
  for (const wild of WILDS) {
    for (let i = 0; i < 4; i++) deck.push(wild);
  }
  return shuffle(deck);
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function parseCard(cardId: string): { color: string; value: string } {
  if (cardId === "wild" || cardId === "wild_draw4")
    return { color: "wild", value: cardId };
  const idx = cardId.indexOf("_");
  if (idx === -1) return { color: "wild", value: cardId };
  return { color: cardId.slice(0, idx), value: cardId.slice(idx + 1) };
}

export function canPlayCard(
  card: string,
  topCard: string,
  currentColor: string,
): boolean {
  const { color, value } = parseCard(card);
  const { value: topValue } = parseCard(topCard);
  if (color === "wild") return true;
  if (color === currentColor) return true;
  if (value === topValue) return true;
  return false;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export const getGame = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    return await ctx.db
      .query("games")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .first();
  },
});

export const getPlayerHand = query({
  args: { roomId: v.id("rooms"), userId: v.string() },
  handler: async (ctx, { roomId, userId }) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_user_room", (q) =>
        q.eq("userId", userId).eq("roomId", roomId),
      )
      .first();
    return player?.hand ?? [];
  },
});

// ─── Start Game ───────────────────────────────────────────────────────────────

export const startGame = mutation({
  args: { roomId: v.id("rooms"), requesterId: v.string() },
  handler: async (ctx, { roomId, requesterId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostId !== requesterId) throw new Error("Only host can start");
    if (room.playerIds.length < 2) throw new Error("Need at least 2 players");

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    const sortedPlayers = players.sort((a, b) => a.seatIndex - b.seatIndex);
    const playerOrder = sortedPlayers.map((p) => p.userId);

    let deck = createDeck();
    const hands: Record<string, string[]> = {};

    for (const player of sortedPlayers) {
      hands[player.userId] = deck.splice(0, 7);
    }

    let firstCard = deck.shift()!;
    while (firstCard.startsWith("wild")) {
      deck.push(firstCard);
      deck = shuffle(deck);
      firstCard = deck.shift()!;
    }

    const { color: firstColor } = parseCard(firstCard);

    for (const player of sortedPlayers) {
      await ctx.db.patch(player._id, { hand: hands[player.userId] });
    }

    await ctx.db.insert("games", {
      roomId,
      deck,
      discardPile: [firstCard],
      currentColor: firstColor,
      currentPlayerIndex: 0,
      playerOrder,
      direction: 1,
      drawStack: 0,
      lastAction: `Game started! ${firstCard} is the first card`,
      status: "active",
      createdAt: Date.now(),
    });

    await ctx.db.patch(roomId, { status: "playing" });

    const firstPlayerId = playerOrder[0];
    if (firstPlayerId.startsWith("bot_")) {
      await ctx.scheduler.runAfter(1500, internal.game.botTurn, { roomId });
    }
  },
});

// ─── Play Card ────────────────────────────────────────────────────────────────

export const playCard = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
    cardId: v.string(),
    chosenColor: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, userId, cardId, chosenColor }) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .first();

    if (!game || game.status !== "active") throw new Error("No active game");

    const currentPlayerId = game.playerOrder[game.currentPlayerIndex];
    if (currentPlayerId !== userId) throw new Error("Not your turn");

    const player = await ctx.db
      .query("players")
      .withIndex("by_user_room", (q) =>
        q.eq("userId", userId).eq("roomId", roomId),
      )
      .first();

    if (!player) throw new Error("Player not found");

    const topCard = game.discardPile[game.discardPile.length - 1];

    // ── Penalty stack enforcement FIRST ──────────────────────────────────────
    // When a draw stack is active the ONLY legal plays are a matching penalty
    // card (draw2 on draw2, wild_draw4 on wild_draw4). Everything else —
    // including same-color cards and plain wilds — is blocked. This check runs
    // before canPlayCard so that color/value matching cannot override it.
    if (game.drawStack > 0) {
      const parsedCard = parseCard(cardId);
      const topParsed = parseCard(topCard);

      if (topParsed.value === "draw2" && parsedCard.value !== "draw2") {
        throw new Error("You must play a +2 or draw!");
      }
      if (topCard === "wild_draw4" && cardId !== "wild_draw4") {
        throw new Error("You must play a +4 or draw!");
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Normal play rules only apply when there is no active penalty stack
    if (game.drawStack === 0) {
      if (!canPlayCard(cardId, topCard, game.currentColor)) {
        throw new Error("Cannot play that card");
      }
    }

    const cardIdx = player.hand.indexOf(cardId);
    if (cardIdx === -1) throw new Error("Card not in hand");

    const handCopy = [...player.hand];
    handCopy.splice(cardIdx, 1);

    // Check for win
    if (handCopy.length === 0) {
      await ctx.db.patch(player._id, { hand: handCopy });
      await ctx.db.patch(game._id, {
        discardPile: [...game.discardPile, cardId],
        winnerId: userId,
        status: "finished",
        lastAction: `🎉 ${player.name} played their last card and WINS!`,
      });
      await ctx.db.patch(roomId, { status: "finished" });
      return;
    }

    await ctx.db.patch(player._id, { hand: handCopy });

    const parsedCard = parseCard(cardId);
    const newColor =
      parsedCard.color === "wild" ? (chosenColor ?? "red") : parsedCard.color;
    let newDirection = game.direction;
    let nextIndex = game.currentPlayerIndex;
    let newDrawStack = game.drawStack;
    let lastAction = `${player.name} played ${cardId}`;
    const numPlayers = game.playerOrder.length;

    if (parsedCard.value === "reverse") {
      newDirection = game.direction * -1;
      nextIndex =
        numPlayers === 2
          ? (nextIndex + newDirection * 2 + numPlayers * 2) % numPlayers
          : (nextIndex + newDirection + numPlayers) % numPlayers;
      lastAction += " — Direction reversed!";
    } else if (parsedCard.value === "skip") {
      nextIndex = (nextIndex + newDirection * 2 + numPlayers * 2) % numPlayers;
      lastAction += " — Next player skipped!";
    } else if (parsedCard.value === "draw2") {
      newDrawStack += 2;
      nextIndex = (nextIndex + newDirection + numPlayers) % numPlayers;
      lastAction += ` — Next player must draw ${newDrawStack}!`;
    } else if (cardId === "wild_draw4") {
      newDrawStack += 4;
      nextIndex = (nextIndex + newDirection + numPlayers) % numPlayers;
      lastAction += ` — Next player must draw ${newDrawStack} and color is ${newColor}!`;
    } else {
      nextIndex = (nextIndex + newDirection + numPlayers) % numPlayers;
    }

    // Reset drawStack unless we played a penalty card
    if (parsedCard.value !== "draw2" && cardId !== "wild_draw4") {
      newDrawStack = 0;
    }

    if (cardId === "wild") lastAction += ` — Color changed to ${newColor}!`;

    await ctx.db.patch(game._id, {
      discardPile: [...game.discardPile, cardId],
      currentColor: newColor,
      currentPlayerIndex: nextIndex,
      direction: newDirection,
      drawStack: newDrawStack,
      lastAction,
    });

    const nextPlayerId = game.playerOrder[nextIndex];
    if (nextPlayerId.startsWith("bot_")) {
      await ctx.scheduler.runAfter(1500, internal.game.botTurn, { roomId });
    }
  },
});

// ─── Draw Card ────────────────────────────────────────────────────────────────

export const drawCard = mutation({
  args: { roomId: v.id("rooms"), userId: v.string() },
  handler: async (ctx, { roomId, userId }) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .first();

    if (!game || game.status !== "active") throw new Error("No active game");

    const currentPlayerId = game.playerOrder[game.currentPlayerIndex];
    if (currentPlayerId !== userId) throw new Error("Not your turn");

    const player = await ctx.db
      .query("players")
      .withIndex("by_user_room", (q) =>
        q.eq("userId", userId).eq("roomId", roomId),
      )
      .first();

    if (!player) throw new Error("Player not found");

    let deck = [...game.deck];
    let discardPile = [...game.discardPile];
    const drawCount = game.drawStack > 0 ? game.drawStack : 1;

    if (deck.length < drawCount) {
      const topCard = discardPile.pop()!;
      deck = [...deck, ...shuffle(discardPile)];
      discardPile = [topCard];
    }

    const drawnCards = deck.splice(0, drawCount);
    const newHand = [...player.hand, ...drawnCards];

    await ctx.db.patch(player._id, { hand: newHand });

    const numPlayers = game.playerOrder.length;
    const nextIndex =
      (game.currentPlayerIndex + game.direction + numPlayers) % numPlayers;

    await ctx.db.patch(game._id, {
      deck,
      discardPile,
      drawStack: 0,
      currentPlayerIndex: nextIndex,
      lastAction: `${player.name} drew ${drawCount} card${drawCount > 1 ? "s" : ""}`,
    });

    const nextPlayerId = game.playerOrder[nextIndex];
    if (nextPlayerId.startsWith("bot_")) {
      await ctx.scheduler.runAfter(1500, internal.game.botTurn, { roomId });
    }
  },
});

// ─── Bot Turn (Internal) ──────────────────────────────────────────────────────

export const botTurn = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .first();

    if (!game || game.status !== "active") return;

    const botId = game.playerOrder[game.currentPlayerIndex];
    if (!botId.startsWith("bot_")) return;

    const bot = await ctx.db
      .query("players")
      .withIndex("by_user_room", (q) =>
        q.eq("userId", botId).eq("roomId", roomId),
      )
      .first();

    if (!bot) return;

    const topCard = game.discardPile[game.discardPile.length - 1];
    const drawStack = game.drawStack;

    const isPenaltyStackTurn = drawStack > 0;
    const topParsed = parseCard(topCard);

    const playable = bot.hand.filter((card) => {
      if (!canPlayCard(card, topCard, game.currentColor)) return false;

      if (!isPenaltyStackTurn) return true;

      const cardParsed = parseCard(card);

      if (topParsed.value === "draw2") {
        return cardParsed.value === "draw2";
      }

      if (topCard === "wild_draw4") {
        return card === "wild_draw4";
      }

      return false;
    });

    if (playable.length > 0) {
      const card =
        playable.find((c) => parseCard(c).value.includes("draw")) ??
        playable.find((c) =>
          ["skip", "reverse"].includes(parseCard(c).value),
        ) ??
        playable[0];

      const { color } = parseCard(card);
      const chosenColor =
        color === "wild"
          ? (COLORS[Math.floor(Math.random() * 4)] as string)
          : color;

      const handCopy = [...bot.hand];
      handCopy.splice(handCopy.indexOf(card), 1);

      if (handCopy.length === 0) {
        await ctx.db.patch(bot._id, { hand: handCopy });
        await ctx.db.patch(game._id, {
          discardPile: [...game.discardPile, card],
          winnerId: botId,
          status: "finished",
          lastAction: `🤖 ${bot.name} wins!`,
        });
        await ctx.db.patch(roomId, { status: "finished" });
        return;
      }

      await ctx.db.patch(bot._id, { hand: handCopy });

      const parsedCard = parseCard(card);
      const newColor =
        parsedCard.color === "wild" ? chosenColor : parsedCard.color;
      let newDirection = game.direction;
      let nextIndex = game.currentPlayerIndex;
      let newDrawStack = game.drawStack;
      const numPlayers = game.playerOrder.length;
      let lastAction = `🤖 ${bot.name} played ${card}`;

      if (parsedCard.value === "reverse") {
        newDirection *= -1;
        nextIndex =
          numPlayers === 2
            ? (nextIndex + newDirection * 2 + numPlayers * 2) % numPlayers
            : (nextIndex + newDirection + numPlayers) % numPlayers;
        lastAction += " — Direction reversed!";
      } else if (parsedCard.value === "skip") {
        nextIndex =
          (nextIndex + newDirection * 2 + numPlayers * 2) % numPlayers;
        lastAction += " — Next player skipped!";
      } else if (parsedCard.value === "draw2") {
        newDrawStack += 2;
        nextIndex = (nextIndex + newDirection + numPlayers) % numPlayers;
        lastAction += ` — Next player must draw ${newDrawStack}!`;
      } else if (card === "wild_draw4") {
        newDrawStack += 4;
        nextIndex = (nextIndex + newDirection + numPlayers) % numPlayers;
        lastAction += ` — Next player must draw ${newDrawStack} and color is ${newColor}!`;
      } else {
        nextIndex = (nextIndex + newDirection + numPlayers) % numPlayers;
      }

      // Reset drawStack when bot plays a non-penalty card
      if (parsedCard.value !== "draw2" && card !== "wild_draw4") {
        newDrawStack = 0;
      }

      if (card === "wild") lastAction += ` — Color changed to ${newColor}!`;

      await ctx.db.patch(game._id, {
        discardPile: [...game.discardPile, card],
        currentColor: newColor,
        currentPlayerIndex: nextIndex,
        direction: newDirection,
        drawStack: newDrawStack,
        lastAction,
      });

      const nextPlayerId = game.playerOrder[nextIndex];
      if (nextPlayerId.startsWith("bot_")) {
        await ctx.scheduler.runAfter(1500, internal.game.botTurn, { roomId });
      }
    } else {
      let deck = [...game.deck];
      let discardPile = [...game.discardPile];
      const drawCount = drawStack > 0 ? drawStack : 1;

      if (deck.length < drawCount) {
        const topCard = discardPile.pop()!;
        deck = [...deck, ...shuffle(discardPile)];
        discardPile = [topCard];
      }

      const drawnCards = deck.splice(0, drawCount);
      await ctx.db.patch(bot._id, { hand: [...bot.hand, ...drawnCards] });

      const numPlayers = game.playerOrder.length;
      const nextIndex =
        (game.currentPlayerIndex + game.direction + numPlayers) % numPlayers;

      await ctx.db.patch(game._id, {
        deck,
        discardPile,
        drawStack: 0,
        currentPlayerIndex: nextIndex,
        lastAction: `🤖 ${bot.name} drew ${drawCount} card${drawCount > 1 ? "s" : ""}`,
      });

      const nextPlayerId = game.playerOrder[nextIndex];
      if (nextPlayerId.startsWith("bot_")) {
        await ctx.scheduler.runAfter(1500, internal.game.botTurn, { roomId });
      }
    }
  },
});

// ─── Game History ─────────────────────────────────────────────────────────────

export const getFinishedGames = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("games")
      .filter((q) => q.eq(q.field("status"), "finished"))
      .order("desc")
      .take(50);
  },
});

export const getFinishedGamesForUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const allFinished = await ctx.db
      .query("games")
      .filter((q) => q.eq(q.field("status"), "finished"))
      .order("desc")
      .take(200);

    return allFinished.filter((game) => game.playerOrder.includes(userId));
  },
});
