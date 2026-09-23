export const IDLE_LOCK_MINUTES = 5;
export const IDLE_LOCK_MS = IDLE_LOCK_MINUTES * 60 * 1000;

export function createIdleLock(onLock: () => void, timeoutMs = IDLE_LOCK_MS) {
  let lastActivity = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let locked = false;

  const stop = () => {
    stopped = true;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  const lock = () => {
    if (stopped) return false;
    locked = true;
    stop();
    onLock();
    return true;
  };

  const schedule = () => {
    if (timer !== undefined) clearTimeout(timer);
    const remaining = timeoutMs - (Date.now() - lastActivity);
    timer = setTimeout(check, Math.max(1, remaining));
  };

  function check(): boolean {
    if (stopped) return false;
    const elapsed = Date.now() - lastActivity;
    // A clock rollback must not extend access to an unlocked vault.
    if (elapsed < 0 || elapsed >= timeoutMs) return lock();
    schedule();
    return false;
  }

  const activity = (): boolean => {
    if (stopped) return locked;
    const elapsed = Date.now() - lastActivity;
    // A late event cannot reset an already-expired deadline.
    if (elapsed < 0 || elapsed >= timeoutMs) return lock();
    lastActivity = Date.now();
    schedule();
    return false;
  };

  schedule();
  return { activity, check, dispose: stop };
}
