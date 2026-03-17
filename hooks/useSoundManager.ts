"use client";

import { useCallback, useRef } from "react";

type SoundName =
  | "cardDeal"
  | "cardPlay"
  | "cardFlip"
  | "chipStack"
  | "chipBet"
  | "allIn"
  | "fold"
  | "yourTurn"
  | "win"
  | "lose"
  | "buttonClick"
  | "roomJoin"
  | "gameStart"
  | "showdown";

function playFile(src: string, volume = 1) {
  const audio = new Audio(src);
  audio.volume = volume;
  audio.play().catch(() => {}); // silently ignore autoplay blocks
}

export function useSoundManager() {
  const mutedRef = useRef(false);

  const play = useCallback((sound: SoundName) => {
    if (mutedRef.current) return;

    try {
      switch (sound) {
        case "cardDeal":
          playFile("/sounds/card-deal.mp3", 0.7);
          break;
        case "cardPlay":
          playFile("/sounds/card-play.mp3");
          break;
        case "cardFlip":
          playFile("/sounds/card-flip.mp3");
          break;
        case "chipStack":
          playFile("/sounds/chip-stack.mp3");
          break;
        case "chipBet":
          playFile("/sounds/chip-bet.mp3", 0.8);
          break;
        case "allIn":
          playFile("/sounds/all-in.mp3");
          break;
        case "fold":
          playFile("/sounds/card-play.mp3", 0.4);
          break;
        case "yourTurn":
          playFile("/sounds/your-turn.mp3");
          break;
        case "win":
          playFile("/sounds/win.mp3");
          break;
        case "lose":
          playFile("/sounds/lose.mp3");
          break;
        case "buttonClick":
          playFile("/sounds/button-click.mp3", 0.5);
          break;
        case "roomJoin":
          playFile("/sounds/room-join.mp3");
          break;
        case "gameStart":
          playFile("/sounds/game-start.mp3");
          break;
        case "showdown":
          playFile("/sounds/win.mp3", 0.6);
          break;
      }
    } catch (e) {
      console.warn("Sound error:", e);
    }
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    mutedRef.current = muted;
  }, []);

  const isMuted = useCallback(() => mutedRef.current, []);

  return { play, setMuted, isMuted };
}
