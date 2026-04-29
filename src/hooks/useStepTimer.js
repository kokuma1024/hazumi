import { useState, useEffect, useRef, useCallback } from "react";
import { playAlert } from "../lib/utils";

export function useStepTimer(steps, onAllComplete) {
  const [stepIdx, setStepIdx] = useState(-1);
  const [elapsed, setElapsed] = useState(0);
  const [flash, setFlash]     = useState(false);
  const startRef = useRef(null);
  const rafRef   = useRef(null);
  const firedRef = useRef(false);

  const currentStep = steps?.[stepIdx] || null;
  const currentSec  = currentStep?.seconds || 60;
  const remaining   = currentSec - elapsed;
  const isOver      = remaining < 0;
  const progress    = Math.min(elapsed / currentSec, 1);

  const startStep = useCallback((idx, offsetSec = 0) => {
    cancelAnimationFrame(rafRef.current);
    firedRef.current = offsetSec > (steps[idx]?.seconds || 60);
    setStepIdx(idx);
    setElapsed(offsetSec);
    startRef.current = Date.now() - offsetSec * 1000;
    const tick = () => {
      const n = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsed(n);
      if (n > (steps[idx]?.seconds || 60) && !firedRef.current) {
        firedRef.current = true;
        playAlert();
        setFlash(true);
        setTimeout(() => setFlash(false), 800);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [steps]);

  const resumeAt = useCallback((idx, offsetSec = 0) => startStep(idx, offsetSec), [startStep]);

  const nextStep = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const next = stepIdx + 1;
    if (next < (steps?.length || 0)) {
      startStep(next);
    } else {
      setStepIdx(-2);
      onAllComplete?.(elapsed);
    }
  }, [stepIdx, steps, elapsed, startStep, onAllComplete]);

  const startCurrentStep = useCallback(() => { startStep(stepIdx); }, [stepIdx, startStep]);

  const stop = useCallback(() => { cancelAnimationFrame(rafRef.current); }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return {
    stepIdx, currentStep, elapsed, remaining, isOver, progress, flash,
    started: stepIdx >= 0,
    done: stepIdx === -2,
    start: () => startStep(0),
    resumeAt, nextStep, startCurrentStep, stop,
    totalSteps: steps?.length || 0,
  };
}
