import { describe, expect, it } from "vitest";
import { co2SavedGrams, ledgerTotals, pointsFor } from "./carbon";

describe("carbon savings", () => {
  it("compares against a 170 g/km car", () => {
    expect(co2SavedGrams(10, 290)).toBe(1410);
  });
  it("never goes negative", () => {
    expect(co2SavedGrams(1, 500)).toBe(0);
  });
  it("gives 1 point per 100 g saved", () => {
    expect(pointsFor(1410)).toBe(14);
    expect(ledgerTotals([{ id: "a", at: "", provider: "lime", co2SavedG: 250, baseline: "" }, { id: "b", at: "", provider: "vvs", co2SavedG: 80, baseline: "" }]).points).toBe(3);
  });
});
