import { useState, useEffect, useRef, useCallback } from "react";
import { playAlert } from "../lib/utils";

export function useTimer(onOver) {
  const [phase, setPhase]     = useState("idle");
  const [elapsed, setElapsed] = useState(0);
  const [flash, setFlash]     = useState(false);
  const startRef = useRef(null);
  const rafRef   = useRef(null);
  const firedRef = useRef(false);
  const estRef   = useRef(0);

  const start = useCallback((estimatedSec, offsetSec = 0) => {
    firedRef.current = offsetSec > estimatedSec;
    estRef.current   = estimatedSec;
    setElapsed(offsetSec);
    setPhase("running");
    startRef.current = Date.now() - offsetSec * 1000;
    const tick = () => {
      const n = Math.floor((Date.now() - startRef.current) / 1000);
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
