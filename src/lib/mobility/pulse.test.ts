import { describe, expect, it } from "vitest";
import {
  activeReports,
  badgesFor,
  tierForXp,
  type PulseReport,
} from "./pulse";

const rep = (id: string, expiresAt: number): PulseReport => ({
  id,
  type: "high_crowding",
  lat: 48.78,
  lng: 9.18,
  upvotes: 0,
  createdAt: expiresAt - 15 * 60_000,
  expiresAt,
});

describe("trust tiers", () => {
  it("maps XP to tiers at the documented thresholds", () => {
    expect(tierForXp(0)).toBe("Newcomer");
    expect(tierForXp(24)).toBe("Newcomer");
    expect(tierForXp(25)).toBe("Navigator");
    expect(tierForXp(80)).toBe("Pathfinder");
    expect(tierForXp(200)).toBe("City Master");
  });
});

describe("badges", () => {
  it("awards First Signal after one report and Community Guardian after five", () => {
    expect(badgesFor(10, 1, 0)).toEqual(["First Signal"]);
    expect(badgesFor(50, 5, 0)).toContain("Community Guardian");
    expect(badgesFor(0, 0, 10)).toContain("Trusted Voice");
    expect(badgesFor(200, 5, 10)).toContain("City Master");
  });
});

describe("report expiry", () => {
  it("drops reports past their 15-minute life", () => {
    const now = 1_000_000;
    const list = [rep("a", now - 1), rep("b", now + 60_000)];
    expect(activeReports(list, now).map((r) => r.id)).toEqual(["b"]);
  });
});
