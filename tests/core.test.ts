import { expect, test, describe, spyOn, afterEach } from "bun:test";
import { MaturityCore } from "../src/index";

describe("MaturityCore Unit Tests", () => {
  const FIXED_NOW = new Date("2026-06-01T10:00:00Z").getTime();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  afterEach(() => {
    spyOn(global, "fetch").mockRestore();
  });

  test("should extract major version correctly", () => {
    expect(MaturityCore.getMajor("^5.3.0")).toBe(5);
    expect(MaturityCore.getMajor("~16.0.0")).toBe(16);
    expect(MaturityCore.getMajor("2.1.1")).toBe(2);
  });

  test("should identify available minor/patch updates within delay", async () => {
    const core = new MaturityCore(3, FIXED_NOW); // 3 days delay

    // Mock fetch for npm registry
    spyOn(core, "fetchPackageMetadata").mockImplementation(async () => ({
      time: {
        "1.0.0": new Date(FIXED_NOW - 10 * ONE_DAY_MS).toISOString(), // 10 days ago
        "1.1.0": new Date(FIXED_NOW - 4 * ONE_DAY_MS).toISOString(),  // 4 days ago (mature)
        "1.1.1": new Date(FIXED_NOW - 1 * ONE_DAY_MS).toISOString(),  // 1 day ago (too young)
      },
      versions: {
        "1.0.0": {},
        "1.1.0": {},
        "1.1.1": {}
      }
    }));

    const info = await core.getUpgradeInfo("test-pkg", "^1.0.0");
    
    expect(info?.bestMinorPatch).toBe("1.1.0"); // 1.1.1 is too new
    expect(info?.newestMajor).toBeNull();
  });

  test("should report major upgrades separately", async () => {
    const core = new MaturityCore(1, FIXED_NOW);

    spyOn(core, "fetchPackageMetadata").mockImplementation(async () => ({
      time: {
        "1.0.0": new Date(FIXED_NOW - 10 * ONE_DAY_MS).toISOString(),
        "2.0.0": new Date(FIXED_NOW - 5 * ONE_DAY_MS).toISOString(), // Major, 5 days ago (mature)
      },
      versions: {
        "1.0.0": {},
        "2.0.0": {}
      }
    }));

    const info = await core.getUpgradeInfo("test-pkg", "^1.0.0");
    
    expect(info?.bestMinorPatch).toBeNull(); // No minor update for v1
    expect(info?.newestMajor).toBe("2.0.0"); // Major update found
  });

  test("should not downgrade versions", async () => {
    const core = new MaturityCore(1, FIXED_NOW);

    spyOn(core, "fetchPackageMetadata").mockImplementation(async () => ({
      time: {
        "1.0.0": new Date(FIXED_NOW - 10 * ONE_DAY_MS).toISOString(),
        "1.1.0": new Date(FIXED_NOW - 5 * ONE_DAY_MS).toISOString(),
      },
      versions: {
        "1.0.0": {},
        "1.1.0": {}
      }
    }));

    // If current version is already 1.1.0
    const info = await core.getUpgradeInfo("test-pkg", "^1.1.0");
    expect(info?.bestMinorPatch).toBeNull(); // No newer version than 1.1.0
  });

  test("should ignore versions that are only 0.5 days old when 1 day delay is set", async () => {
    const core = new MaturityCore(1, FIXED_NOW); // 1 day delay

    spyOn(core, "fetchPackageMetadata").mockImplementation(async () => ({
      time: {
        "1.0.0": new Date(FIXED_NOW - 10 * ONE_DAY_MS).toISOString(),
        "1.1.0": new Date(FIXED_NOW - 0.5 * ONE_DAY_MS).toISOString(), // 0.5 days old (too young)
      },
      versions: {
        "1.0.0": {},
        "1.1.0": {}
      }
    }));

    const info = await core.getUpgradeInfo("test-pkg", "1.0.0");
    
    // Should NOT find 1.1.0 because it's only 0.5 days old
    expect(info?.bestMinorPatch).toBeNull();
  });
});
