import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("user")),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  rooms: defineTable({
    name: v.string(),
    hostId: v.string(),
    hostName: v.string(),
    status: v.union(
      v.literal("waiting"),
      v.literal("playing"),
      v.literal("finished")
    ),
    maxPlayers: v.number(),
    playerIds: v.array(v.string()),
    bigBlind: v.number(),
    startingChips: v.number(),
    createdAt: v.number(),
  }).index("by_status", ["status"]),

  players: defineTable({
    roomId: v.id("rooms"),
    userId: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    isBot: v.boolean(),
    isReady: v.boolean(),
    isConnected: v.boolean(),
    chips: v.number(),
    seatIndex: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_user_room", ["userId", "roomId"]),

  games: defineTable({
    roomId: v.id("rooms"),
    // Deck stored as serialized card strings "AS","KH","2D" etc.
    deck: v.array(v.string()),
    // Hole cards per player: { [playerId]: ["AS","KH"] }
    holeCards: v.string(), // JSON stringified
    communityCards: v.array(v.string()),
    pot: v.number(),
    sidePots: v.string(), // JSON: [{amount, eligiblePlayerIds}]
    currentBet: v.number(),
    minRaise: v.number(),
    bigBlind: v.number(),
    phase: v.union(
      v.literal("preflop"),
      v.literal("flop"),
      v.literal("turn"),
      v.literal("river"),
      v.literal("showdown")
    ),
    dealerIndex: v.number(),
    currentPlayerIndex: v.number(),
    playerOrder: v.array(v.string()),
    // Per-round bets
    roundBets: v.string(), // JSON: { [playerId]: number }
    // Player states: fold/active/allIn
    playerStates: v.string(), // JSON: { [playerId]: "active"|"folded"|"allIn" }
    lastAction: v.optional(v.string()),
    lastRaiserId: v.optional(v.string()),
    winnerId: v.optional(v.string()),
    winnerIds: v.optional(v.array(v.string())),
    winningHand: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("finished")),
    handNumber: v.number(),
    createdAt: v.number(),
  }).index("by_room", ["roomId"]),

  // Per-player chip ledger across hands
  chipLedger: defineTable({
    roomId: v.id("rooms"),
    userId: v.string(),
    chips: v.number(),
    handsPlayed: v.number(),
    handsWon: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_user_room", ["userId", "roomId"]),

  messages: defineTable({
    roomId: v.id("rooms"),
    userId: v.string(),
    userName: v.string(),
    text: v.string(),
    createdAt: v.number(),
  }).index("by_room", ["roomId"]),
});
