import { useState, useEffect, useRef, useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { playAlert } from "../lib/utils";
import type { TimerPhase } from "../types";

export interface UseTimerReturn {
  phase: TimerPhase;
  setPhase: Dispatch<SetStateAction<TimerPhase>>;
  elapsed: number;
  remaining: number;
  flash: boolean;
  start: (estimatedSec: number, offsetSec?: number) => void;
  stop: () => void;
}

export function useTimer(onOver?: () => void): UseTimerReturn {
  const [phase, setPhase]     = useState<TimerPhase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [flash, setFlash]     = useState(false);
  const startRef = useRef<number | null>(null);
  const rafRef   = useRef<number>(0);
  const firedRef = useRef(false);
  const estRef   = useRef(0);

  const start = useCallback((estimatedSec: number, offsetSec = 0) => {
    firedRef.current = offsetSec > estimatedSec;
    estRef.current   = estimatedSec;
    setElapsed(offsetSec);
    setPhase("running");
    startRef.current = Date.now() - offsetSec * 1000;
    const tick = () => {
      const n = Math.floor((Date.now() - startRef.current!) / 1000);
      setElapsed(n);
      if (n > estimatedSec && !firedRef.current) {
        firedRef.current = true;
        playAlert();
        setFlash(true);
        setTimeout(() => setFlash(false), 900);
        onOver?.();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const remaining = (estRef.current || 0) - elapsed;

  return { phase, setPhase, elapsed, remaining, flash, start, stop };
}
