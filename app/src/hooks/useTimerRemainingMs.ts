import { useState, useEffect, useRef } from "react";

type TimerState = "pending" | "running" | "paused" | "completed" | "cancelled";

/**
 * Returns smoothly interpolated remaining milliseconds for a timer.
 * When state is "running", interpolates client-side between server snapshots;
 * otherwise returns the server-provided remaining_ms as-is.
 */
export function useTimerRemainingMs(
  remainingMs: number,
  lastUpdatedTimestampMs: number,
  state: TimerState
): number {
  const [displayMs, setDisplayMs] = useState(remainingMs);
  const baseRef = useRef({ remainingMs, lastUpdatedTimestampMs });

  // When server values change, update base and immediate display
  if (
    state !== "running" ||
    baseRef.current.remainingMs !== remainingMs ||
    baseRef.current.lastUpdatedTimestampMs !== lastUpdatedTimestampMs
  ) {
    baseRef.current = { remainingMs, lastUpdatedTimestampMs };
  }

  useEffect(() => {
    if (state !== "running") {
      setDisplayMs(remainingMs);
      return;
    }

    const compute = () => {
      const { remainingMs: base, lastUpdatedTimestampMs: last } = baseRef.current;
      const elapsed = Date.now() - last;
      const value = Math.max(0, base - elapsed);
      setDisplayMs(value);
    };

    compute();
    const id = setInterval(compute, 100);
    return () => clearInterval(id);
  }, [state, remainingMs, lastUpdatedTimestampMs]);

  return state === "running" ? displayMs : remainingMs;
}
