import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIdleLock, IDLE_LOCK_MS } from "./idle-lock";

describe("idle vault locking", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => vi.useRealTimers());

  it("locks once at the inactivity deadline", () => {
    const onLock = vi.fn();
    const idle = createIdleLock(onLock);
    vi.advanceTimersByTime(IDLE_LOCK_MS - 1);
    expect(onLock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onLock).toHaveBeenCalledOnce();
    idle.check();
    vi.runOnlyPendingTimers();
    expect(onLock).toHaveBeenCalledOnce();
  });

  it("counts recent interaction and locks after the new deadline", () => {
    const onLock = vi.fn();
    const idle = createIdleLock(onLock);
    vi.advanceTimersByTime(IDLE_LOCK_MS - 1000);
    expect(idle.activity()).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(onLock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(IDLE_LOCK_MS - 1000);
    expect(onLock).toHaveBeenCalledOnce();
  });

  it("locks on resume if background timer execution was delayed", () => {
    const onLock = vi.fn();
    const idle = createIdleLock(onLock);
    vi.setSystemTime(IDLE_LOCK_MS + 1000);
    expect(idle.check()).toBe(true);
    expect(onLock).toHaveBeenCalledOnce();
  });

  it("rejects a late interaction rather than extending an expired vault", () => {
    const onLock = vi.fn();
    const idle = createIdleLock(onLock);
    vi.setSystemTime(IDLE_LOCK_MS + 1);
    expect(idle.activity()).toBe(true);
    expect(onLock).toHaveBeenCalledOnce();
    expect(idle.activity()).toBe(true);
    expect(onLock).toHaveBeenCalledOnce();
  });

  it("locks if the system clock moves backwards", () => {
    const onLock = vi.fn();
    vi.setSystemTime(IDLE_LOCK_MS);
    const idle = createIdleLock(onLock);
    vi.setSystemTime(0);
    expect(idle.check()).toBe(true);
    expect(onLock).toHaveBeenCalledOnce();
  });

  it("cancels its timer when the vault is no longer unlocked", () => {
    const onLock = vi.fn();
    const idle = createIdleLock(onLock);
    idle.dispose();
    vi.advanceTimersByTime(IDLE_LOCK_MS * 2);
    expect(onLock).not.toHaveBeenCalled();
  });
});
