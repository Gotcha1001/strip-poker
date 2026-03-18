"use client";

/**
 * VideoLobby.tsx
 * Drop-in video panel for the ONLINE game room only.
 * Uses livekit-client directly — no deprecated wrappers, no `any` types.
 *
 * Fully React 19 compliant:
 *   ✅ No setState() synchronously inside an effect body
 *   ✅ No ref.current accessed during render
 *   ✅ No race condition on initial snapshot
 *   ✅ No pendingRef — useState drives everything rendered
 *
 * Install: npm install livekit-client
 * Place at: app/components/VideoLobby.tsx
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  Participant,
  Track,
  TrackPublication,
  VideoPresets,
  ConnectionState,
} from "livekit-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  ChevronDown,
  ChevronUp,
  Wifi,
  WifiOff,
} from "lucide-react";

// ─── Props ────────────────────────────────────────────────────────────────────

interface VideoLobbyProps {
  roomId: string;
  userId: string;
  userName: string;
  defaultCollapsed?: boolean;
}

// ─── Per-participant snapshot ─────────────────────────────────────────────────

interface ParticipantState {
  participant: Participant;
  videoTrack: Track | null;
  audioTrack: Track | null;
  isLocal: boolean;
}

// ─── Token fetcher ────────────────────────────────────────────────────────────

async function fetchToken(
  roomId: string,
  userId: string,
  userName: string
): Promise<string> {
  const res = await fetch(
    `/api/livekit-token?room=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}`
  );
  if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
  const data = (await res.json()) as { token: string };
  return data.token;
}

// ─── <video> that attaches a LiveKit Track ────────────────────────────────────

function TrackVideo({ track, isLocal }: { track: Track; isLocal: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => { track.detach(el); };
  }, [track]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={isLocal}
      className="absolute inset-0 w-full h-full object-cover"
      style={{ transform: isLocal ? "scaleX(-1)" : "none" }}
    />
  );
}

// ─── <audio> that attaches a LiveKit Track ────────────────────────────────────

function TrackAudio({ track }: { track: Track }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => { track.detach(el); };
  }, [track]);

  return <audio ref={ref} autoPlay />;
}

// ─── Single participant tile ──────────────────────────────────────────────────

function ParticipantTile({ state }: { state: ParticipantState }) {
  const { participant, videoTrack, audioTrack, isLocal } = state;
  const displayName = participant.name ?? participant.identity;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      className="relative rounded-xl overflow-hidden bg-black/60 border border-white/10 flex-shrink-0"
      style={{ width: 120, height: 90 }}
    >
      {videoTrack ? (
        <TrackVideo track={videoTrack} isLocal={isLocal} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-900/50 to-black/80">
          <div className="w-9 h-9 rounded-full bg-emerald-700 flex items-center justify-center text-white font-bold text-sm select-none">
            {displayName.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Never play back local audio — causes echo */}
      {audioTrack && !isLocal && <TrackAudio track={audioTrack} />}

      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1 flex items-center justify-between">
        <span className="text-[9px] font-semibold text-white truncate leading-none">
          {isLocal ? "You" : displayName}
        </span>
        <div className="flex items-center gap-0.5">
          {!audioTrack && <MicOff size={8} className="text-red-400" />}
          {!videoTrack && <VideoOff size={8} className="text-red-400" />}
        </div>
      </div>

      {isLocal && (
        <div className="absolute top-1 left-1 text-[7px] font-black uppercase tracking-wider bg-emerald-600/80 text-white px-1 py-0.5 rounded">
          YOU
        </div>
      )}
    </motion.div>
  );
}

// ─── buildSnapshot (pure function, defined outside hook) ─────────────────────
// Pure function — no closure over React state, safe to call anywhere.

function buildSnapshot(room: Room): ParticipantState[] {
  const toState = (p: Participant, isLocal: boolean): ParticipantState => {
    let videoTrack: Track | null = null;
    let audioTrack: Track | null = null;

    p.trackPublications.forEach((pub: TrackPublication) => {
      if (!pub.track) return;
      if (pub.kind === Track.Kind.Video) videoTrack = pub.track;
      if (pub.kind === Track.Kind.Audio) audioTrack = pub.track;
    });

    return { participant: p, videoTrack, audioTrack, isLocal };
  };

  return [
    toState(room.localParticipant, true),
    ...Array.from(room.remoteParticipants.values()).map(
      (p: RemoteParticipant) => toState(p, false)
    ),
  ];
}

// ─── Hook: Room events → ParticipantState[] ───────────────────────────────────
//
// React 19 rules:
//
//   RULE 1 — No setState() synchronously inside an effect body.
//     ✅ Initial snapshot captured into a local const, then passed to
//        queueMicrotask which runs AFTER the effect body returns.
//        Event-listener callbacks (refresh) are always async — setState is
//        fine there unconditionally.
//
//   RULE 2 — No ref.current accessed during render.
//     ✅ Only useState drives the return value. No refs are read here.
//
//   Race condition fix vs previous version:
//     ✅ `queueMicrotask(() => setStates(initial))` closes over the local
//        `initial` const — not a ref — so even if a LiveKit event fires
//        between the effect body and the microtask, the initial render still
//        gets the value that was correct at effect-run time.

function useParticipantStates(room: Room | null): ParticipantState[] {
  const [states, setStates] = useState<ParticipantState[]>([]);

  useEffect(() => {
    if (!room) {
      // ✅ queueMicrotask defers setState past the effect body
      queueMicrotask(() => setStates([]));
      return;
    }

    // ✅ Capture into a local const — safe closure for the microtask,
    //    immune to any later mutations
    const initial = buildSnapshot(room);
    queueMicrotask(() => setStates(initial));

    // ✅ Called from LiveKit event listeners — always async, setState fine
    const refresh = () => setStates(buildSnapshot(room));

    room
      .on(RoomEvent.ParticipantConnected,    refresh)
      .on(RoomEvent.ParticipantDisconnected, refresh)
      .on(RoomEvent.TrackSubscribed,         refresh)
      .on(RoomEvent.TrackUnsubscribed,       refresh)
      .on(RoomEvent.TrackPublished,          refresh)
      .on(RoomEvent.TrackUnpublished,        refresh)
      .on(RoomEvent.LocalTrackPublished,     refresh)
      .on(RoomEvent.LocalTrackUnpublished,   refresh);

    return () => {
      room
        .off(RoomEvent.ParticipantConnected,    refresh)
        .off(RoomEvent.ParticipantDisconnected, refresh)
        .off(RoomEvent.TrackSubscribed,         refresh)
        .off(RoomEvent.TrackUnsubscribed,       refresh)
        .off(RoomEvent.TrackPublished,          refresh)
        .off(RoomEvent.TrackUnpublished,        refresh)
        .off(RoomEvent.LocalTrackPublished,     refresh)
        .off(RoomEvent.LocalTrackUnpublished,   refresh);
    };
  }, [room]);

  // ✅ Pure useState value — never a ref
  return states;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VideoLobby({
  roomId,
  userId,
  userName,
  defaultCollapsed = false,
}: VideoLobbyProps) {
  const roomRef                     = useRef<Room | null>(null);
  const [connState, setConnState]   = useState<ConnectionState>(ConnectionState.Disconnected);
  const [room, setRoom]             = useState<Room | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [isCollapsed, setCollapsed] = useState(defaultCollapsed);
  const [cameraOn, setCameraOn]     = useState(false);
  const [micOn, setMicOn]           = useState(false);

  const participantStates = useParticipantStates(room);

  // ── Connect on mount, disconnect on unmount ──────────────────────────────
  useEffect(() => {
    const lkRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: { resolution: VideoPresets.h180.resolution },
    });

    roomRef.current = lkRoom;

    // ✅ setState inside event listener — not synchronous in effect body
    lkRoom.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      setConnState(state);
    });

    // ✅ setState inside async .then()/.catch() — not synchronous in effect body
    fetchToken(roomId, userId, userName)
      .then(async (token) => {
        const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "";
        if (!serverUrl) throw new Error("NEXT_PUBLIC_LIVEKIT_URL is not set in .env");
        await lkRoom.connect(serverUrl, token);
        setRoom(lkRoom);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Video connection failed");
      });

    return () => {
      lkRoom.disconnect();
      roomRef.current = null;
      setRoom(null);
    };
  }, [roomId, userId, userName]);

  // ── Toggle camera — roomRef read in event handler, never in render ────────
  const handleToggleCamera = useCallback(async () => {
    const r = roomRef.current;
    if (!r) return;
    const next = !cameraOn;
    await r.localParticipant.setCameraEnabled(next);
    setCameraOn(next);
  }, [cameraOn]);

  // ── Toggle mic ────────────────────────────────────────────────────────────
  const handleToggleMic = useCallback(async () => {
    const r = roomRef.current;
    if (!r) return;
    const next = !micOn;
    await r.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  }, [micOn]);

  const isConnected  = connState === ConnectionState.Connected;
  const isConnecting =
    connState === ConnectionState.Connecting ||
    connState === ConnectionState.Reconnecting;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm overflow-hidden">

      {/* Header — always visible */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-all"
      >
        <div className="flex items-center gap-2">
          <Video size={14} className="text-emerald-400" />
          <span className="text-xs font-bold text-white uppercase tracking-widest">
            Video Chat
          </span>
          {isConnected  && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          {isConnecting && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
          {error        && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
        </div>
        <div className="text-white/40">
          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </div>
      </button>

      {/* Body */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 flex flex-col gap-3">

              {error && (
                <p className="text-xs text-red-400 flex items-center gap-1.5 py-1">
                  <WifiOff size={11} /> {error}
                </p>
              )}

              {!error && isConnecting && (
                <p className="text-xs text-amber-400/70 py-1 animate-pulse">
                  Connecting to video…
                </p>
              )}

              {!error && isConnected && (
                <>
                  {/* Participant tiles */}
                  <div className="flex gap-2 flex-wrap">
                    <AnimatePresence>
                      {participantStates.map((s) => (
                        <ParticipantTile
                          key={s.participant.identity}
                          state={s}
                        />
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleToggleMic}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        micOn
                          ? "bg-emerald-900/40 border-emerald-600/40 text-emerald-300 hover:bg-emerald-900/60"
                          : "bg-red-900/40 border-red-600/40 text-red-300 hover:bg-red-900/60"
                      }`}
                    >
                      {micOn ? <Mic size={12} /> : <MicOff size={12} />}
                      {micOn ? "Mic On" : "Muted"}
                    </button>

                    <button
                      onClick={handleToggleCamera}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        cameraOn
                          ? "bg-emerald-900/40 border-emerald-600/40 text-emerald-300 hover:bg-emerald-900/60"
                          : "bg-red-900/40 border-red-600/40 text-red-300 hover:bg-red-900/60"
                      }`}
                    >
                      {cameraOn ? <Video size={12} /> : <VideoOff size={12} />}
                      {cameraOn ? "Camera On" : "Camera Off"}
                    </button>

                    <span className="ml-auto flex items-center gap-1 text-[9px] text-emerald-400/60">
                      <Wifi size={9} /> Live
                    </span>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}