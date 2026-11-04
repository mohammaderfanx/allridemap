import { describe, expect, it } from "vitest";
import { formatLocalTime, planIntercity } from "./intercity";
import { parseLedger } from "./carbon";

const at = Date.UTC(2026, 10, 3, 6, 0); // 07:00 Stuttgart

describe("intercity planner", () => {
  it("never leaves before the requested time and arrives after leaving", () => {
    for (const t of planIntercity("munich", at)) {
      expect(t.departUtc).toBeGreaterThanOrEqual(at);
      expect(t.arriveUtc).toBeGreaterThan(t.departUtc);
    }
  });
  it("legs follow each other without gaps or overlaps", () => {
    for (const t of planIntercity("london", at)) {
      t.legs.forEach((l, i) => i && expect(l.departUtc).toBeGreaterThanOrEqual(t.legs[i - 1]!.arriveUtc));
    }
  });
  it("offers rail, coach and eVTOL to Munich", () => {
    const modes = new Set(planIntercity("munich", at).map((t) => t.mode));
    expect([...modes].sort()).toEqual(["evtol", "high_speed_rail", "intercity_bus"]);
  });
  it("renders the same UTC instant in each city's local time", () => {
    const t = Date.UTC(2026, 10, 3, 12, 0);
    expect(formatLocalTime(t, "Europe/Berlin")).toBe("13:00");
    expect(formatLocalTime(t, "Europe/London")).toBe("12:00");
    expect(formatLocalTime(t, "Europe/Istanbul")).toBe("15:00");
  });
});

describe("green pass storage", () => {
  it("drops damaged data instead of crashing", () => {
    expect(parseLedger("{not json")).toEqual([]);
    expect(parseLedger('{"a":1}')).toEqual([]);
    expect(parseLedger('[{"id":"a","at":"x","provider":"lime","co2SavedG":5,"baseline":""},{"id":3}]')).toHaveLength(1);
  });
});
