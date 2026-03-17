"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, ImageOff } from "lucide-react";
import { BACKGROUNDS, useBackground } from "@/app/context/BackgroundContext";
import { useState } from "react";

export default function SettingsPage() {
  const { selected, setBackground } = useBackground();
  const [previewId, setPreviewId] = useState<string | null>(null);

  const activeId = previewId ?? selected.id;
  const activeBg = BACKGROUNDS.find((b) => b.id === activeId) ?? BACKGROUNDS[0];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black dark:text-white">
          Settings
        </h1>
        <p className="text-gray-500 dark:text-emerald-300">
          Personalise your poker experience
        </p>
      </div>

      <div className="p-6 rounded-2xl border border-gray-200 dark:border-emerald-800 bg-white dark:bg-emerald-950/40 shadow-sm mb-6">
        <h2 className="text-base font-semibold text-black dark:text-white mb-1">
          Game Board Background
        </h2>
        <p className="text-sm text-gray-500 dark:text-emerald-400 mb-5">
          Hover to preview · click to select · saved automatically
        </p>

        {/* Live preview strip */}
        <div className="relative w-full h-36 rounded-xl overflow-hidden mb-6 border border-gray-200 dark:border-emerald-800">
          {activeBg.src ? (
            <img
              src={activeBg.src}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 40%, #1a4a2e 0%, #0f2d1c 45%, #091a10 100%)",
              }}
            />
          )}
          {activeBg.overlay && (
            <div
              className="absolute inset-0"
              style={{ background: activeBg.overlay }}
            />
          )}
          <div className="absolute bottom-3 left-3 px-3 py-1 rounded-lg bg-black/50 backdrop-blur-sm text-white text-xs font-semibold z-10">
            {activeBg.label}
          </div>
          <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-40 pointer-events-none z-10">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-8 h-12 rounded-lg bg-white/20 border border-white/30"
                style={{ transform: `rotate(${(i - 1.5) * 5}deg)` }}
              />
            ))}
          </div>
        </div>

        {/* Grid of options */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {BACKGROUNDS.map((bg) => {
            const isSelected = selected.id === bg.id;
            return (
              <motion.button
                key={bg.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                onMouseEnter={() => setPreviewId(bg.id)}
                onMouseLeave={() => setPreviewId(null)}
                onClick={() => setBackground(bg.id)}
                className="relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all focus:outline-none"
                style={{
                  borderColor: isSelected ? "#059669" : "transparent",
                  boxShadow: isSelected
                    ? "0 0 0 1px #059669, 0 0 16px rgba(5,150,105,0.4)"
                    : "0 2px 8px rgba(0,0,0,0.2)",
                }}
              >
                {/* Thumbnail or CSS fallback */}
                {bg.thumbnail ? (
                  <img
                    src={bg.thumbnail}
                    alt={bg.label}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(ellipse at 38% 32%, #1a4a2e 0%, #0f2d1c 50%, #091a10 100%)",
                    }}
                  >
                    <div
                      className="absolute inset-0 opacity-50"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
                        backgroundSize: "100px 100px",
                      }}
                    />
                  </div>
                )}
                {bg.overlay && (
                  <div
                    className="absolute inset-0"
                    style={{ background: bg.overlay }}
                  />
                )}
                {!bg.thumbnail && bg.id !== "felt" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ImageOff size={16} className="text-white/30" />
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 px-1.5 py-1 bg-black/50 backdrop-blur-sm">
                  <p className="text-white text-[9px] font-semibold text-center truncate">
                    {bg.label}
                  </p>
                </div>
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center"
                    >
                      <Check size={11} className="text-white" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="p-4 rounded-2xl border border-dashed border-gray-300 dark:border-emerald-800/60 text-sm text-gray-400 dark:text-emerald-500">
        <p className="font-semibold mb-1 text-gray-500 dark:text-emerald-400">
          Adding custom backgrounds
        </p>
        <p>
          Drop image files into{" "}
          <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-emerald-900/40 text-xs font-mono">
            /public/backgrounds/
          </code>{" "}
          and register them in{" "}
          <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-emerald-900/40 text-xs font-mono">
            BackgroundContext.tsx
          </code>
          . Recommended: 1920×1080 JPG for{" "}
          <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-emerald-900/40 text-xs font-mono">
            src
          </code>
          , 400×225 JPG for{" "}
          <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-emerald-900/40 text-xs font-mono">
            thumbnail
          </code>
          .
        </p>
      </div>
    </div>
  );
}
