"use client";

import { createContext, useContext, useState } from "react";

export interface BackgroundOption {
  id: string;
  label: string;
  thumbnail: string; // path in /public — empty = CSS fallback
  src: string; // path in /public — empty = CSS fallback
  overlay?: string;
}

// ── Register your images from /public/backgrounds/ here ─────────────────────
export const BACKGROUNDS: BackgroundOption[] = [
  {
    id: "felt",
    label: "Green Felt",
    thumbnail: "",
    src: "",
    overlay: undefined,
  },
  {
    id: "space",
    label: "Deep Space",
    thumbnail: "/backgrounds/space-thumb.jpg",
    src: "/backgrounds/space-thumb.jpg",
    overlay: "rgba(0,0,0,0.35)",
  },
  {
    id: "forest",
    label: "Dark Forest",
    thumbnail: "/backgrounds/forest-thumb.jpg",
    src: "/backgrounds/forest-thumb.jpg",
    overlay: "rgba(0,0,0,0.4)",
  },
  {
    id: "neon",
    label: "Neon City",
    thumbnail: "/backgrounds/neon-thumb.jpg",
    src: "/backgrounds/neon-thumb.jpg",
    overlay: "rgba(0,0,0,0.3)",
  },
  {
    id: "ocean",
    label: "Ocean Depths",
    thumbnail: "/backgrounds/ocean-thumb.jpg",
    src: "/backgrounds/ocean-thumb.jpg",
    overlay: "rgba(0,10,30,0.45)",
  },
  {
    id: "lava",
    label: "Lava Flow",
    thumbnail: "/backgrounds/lava-thumb.jpg",
    src: "/backgrounds/lava-thumb.jpg",
    overlay: "rgba(0,0,0,0.4)",
  },
];

const STORAGE_KEY = "poker-board-bg";
const DEFAULT_ID = "felt";

interface BackgroundContextValue {
  selected: BackgroundOption;
  setBackground: (id: string) => void;
}

const BackgroundContext = createContext<BackgroundContextValue>({
  selected: BACKGROUNDS[0],
  setBackground: () => {},
});

export function BackgroundProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_ID;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && BACKGROUNDS.find((b) => b.id === saved)) return saved;
    return DEFAULT_ID;
  });

  const setBackground = (id: string) => {
    setSelectedId(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const selected =
    BACKGROUNDS.find((b) => b.id === selectedId) ?? BACKGROUNDS[0];

  return (
    <BackgroundContext.Provider value={{ selected, setBackground }}>
      {children}
    </BackgroundContext.Provider>
  );
}

export const useBackground = () => useContext(BackgroundContext);
