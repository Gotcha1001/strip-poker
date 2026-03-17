import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listOpenRooms = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("rooms")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .order("desc")
      .take(20);
  },
});

export const getRoom = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    return await ctx.db.get(roomId);
  },
});

export const getRoomPlayers = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    return await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
  },
});

export const createRoom = mutation({
  args: {
    name: v.string(),
    hostId: v.string(),
    hostName: v.string(),
    avatarUrl: v.optional(v.string()),
    maxPlayers: v.number(),
    bigBlind: v.optional(v.number()),
    startingChips: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const bb = args.bigBlind ?? 20;
    const startChips = args.startingChips ?? 1000;
    const roomId = await ctx.db.insert("rooms", {
      name: args.name,
      hostId: args.hostId,
      hostName: args.hostName,
      status: "waiting",
      maxPlayers: args.maxPlayers,
      playerIds: [args.hostId],
      bigBlind: bb,
      startingChips: startChips,
      createdAt: Date.now(),
    });
    await ctx.db.insert("players", {
      roomId,
      userId: args.hostId,
      name: args.hostName,
      avatarUrl: args.avatarUrl,
      isBot: false,
      isReady: false,
      isConnected: true,
      chips: startChips,
      seatIndex: 0,
    });
    return roomId;
  },
});

export const joinRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
    userName: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    if (room.status !== "waiting") throw new Error("Game already started");
    if (room.playerIds.length >= room.maxPlayers) throw new Error("Room is full");
    if (room.playerIds.includes(args.userId)) return args.roomId;

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    await ctx.db.patch(args.roomId, {
      playerIds: [...room.playerIds, args.userId],
    });
    await ctx.db.insert("players", {
      roomId: args.roomId,
      userId: args.userId,
      name: args.userName,
      avatarUrl: args.avatarUrl,
      isBot: false,
      isReady: false,
      isConnected: true,
      chips: room.startingChips,
      seatIndex: players.length,
    });
    return args.roomId;
  },
});

export const addBot = mutation({
  args: { roomId: v.id("rooms"), requesterId: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostId !== args.requesterId) throw new Error("Only host can add bots");
    if (room.playerIds.length >= room.maxPlayers) throw new Error("Room is full");

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    const botCount = players.filter((p) => p.isBot).length;
    const botNames = ["Bot Ace", "Bot River", "Bot Bluff", "Bot Royal"];
    const botId = `bot_${Date.now()}`;
    const botName = botNames[botCount] ?? `Bot ${botCount + 1}`;

    await ctx.db.patch(args.roomId, {
      playerIds: [...room.playerIds, botId],
    });
    await ctx.db.insert("players", {
      roomId: args.roomId,
      userId: botId,
      name: botName,
      isBot: true,
      isReady: true,
      isConnected: true,
      chips: room.startingChips,
      seatIndex: players.length,
    });
  },
});

export const leaveRoom = mutation({
  args: { roomId: v.id("rooms"), userId: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return;
    const player = await ctx.db
      .query("players")
      .withIndex("by_user_room", (q) =>
        q.eq("userId", args.userId).eq("roomId", args.roomId)
      )
      .first();
    if (player) await ctx.db.delete(player._id);
    const newIds = room.playerIds.filter((id) => id !== args.userId);
    if (newIds.length === 0) {
      await ctx.db.delete(args.roomId);
    } else {
      const newHostId = newIds[0];
      const hostPlayer = await ctx.db
        .query("players")
        .withIndex("by_user_room", (q) =>
          q.eq("userId", newHostId).eq("roomId", args.roomId)
        )
        .first();
      await ctx.db.patch(args.roomId, {
        playerIds: newIds,
        hostId: newHostId,
        hostName: hostPlayer?.name ?? "Unknown",
      });
    }
  },
});

export const setReady = mutation({
  args: { roomId: v.id("rooms"), userId: v.string(), isReady: v.boolean() },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_user_room", (q) =>
        q.eq("userId", args.userId).eq("roomId", args.roomId)
      )
      .first();
    if (player) await ctx.db.patch(player._id, { isReady: args.isReady });
  },
});

export const sendMessage = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
    userName: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      roomId: args.roomId,
      userId: args.userId,
      userName: args.userName,
      text: args.text,
      createdAt: Date.now(),
    });
  },
});

export const getMessages = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .order("asc")
      .take(100);
  },
});