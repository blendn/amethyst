import { describe, expect, it } from "vitest";
import { matrix, percentile } from "./model";

describe("Argon2id benchmark matrix", () => {
  it("skips all memory sizes above the operator's cap", () => {
    expect(matrix(32_768)).toHaveLength(12);
    expect(matrix(32_768).every(({ memoryKiB }) => memoryKiB <= 32_768)).toBe(
      true,
    );
    expect(matrix(19_456)[0]).toEqual({
      memoryKiB: 19_456,
      iterations: 2,
      parallelism: 1,
      hashLength: 32,
    });
    expect(matrix(262_144)).toHaveLength(30);
  });

  it("rejects invalid allocation caps", () => {
    expect(() => matrix(19_455)).toThrow();
    expect(() => matrix(262_145)).toThrow();
    expect(() => matrix(Number.NaN)).toThrow();
    expect(() => matrix(19_456.5)).toThrow();
  });

  it("computes interpolated p50 and p95 without changing raw order", () => {
    const values = [20, 10, 40, 30];
    expect(percentile(values, 0.5)).toBe(25);
    expect(percentile(values, 0.95)).toBe(38.5);
    expect(values).toEqual([20, 10, 40, 30]);
    expect(percentile([], 0.95)).toBeNull();
  });
});
