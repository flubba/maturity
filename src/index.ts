import { readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { compareVersions } from "compare-versions";
import path from "node:path";

export interface PackageInfo {
  bestMinorPatch: string | null;
  newestMajor: string | null;
}

export class MaturityCore {
  private delayMs: number;
  private now: number;

  constructor(delayDays: number = 1, now: number = Date.now()) {
    this.delayMs = delayDays * 24 * 60 * 60 * 1000;
    this.now = now;
  }

  static getMajor(version: string): number {
    const match = version.replace(/^[\^~]/, "").match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  static cleanVersion(v: string): string {
    return v.replace(/^[\^~]/, "");
  }

  async fetchPackageMetadata(packageName: string): Promise<any> {
    const response = await fetch(`https://registry.npmjs.org/${packageName.replace("/", "%2f")}`);
    if (!response.ok) return null;
    return response.json();
  }

  async getUpgradeInfo(packageName: string, currentRange: string, allowMajor: boolean = false): Promise<PackageInfo | null> {
    const data = await this.fetchPackageMetadata(packageName);
    if (!data || !data.time || !data.versions) return null;

    const times = data.time;
    const versions = Object.keys(data.versions).reverse();
    const currentMajor = MaturityCore.getMajor(currentRange);
    const currentVer = MaturityCore.cleanVersion(currentRange);

    let bestMinorPatch = null;
    let newestMajor = null;

    for (const version of versions) {
      if (version.includes("-")) continue;

      const releaseTime = new Date(times[version]).getTime();
      if (this.now - releaseTime >= this.delayMs) {
        const major = MaturityCore.getMajor(version);

        if (major === currentMajor) {
          if (!bestMinorPatch || compareVersions(version, bestMinorPatch) > 0) {
            if (compareVersions(version, currentVer) > 0) {
              bestMinorPatch = version;
            }
          }
        } else if (major > currentMajor) {
          if (!newestMajor || compareVersions(version, newestMajor) > 0) {
            newestMajor = version;
          }
        }
      }
    }

    if (allowMajor && newestMajor) {
      return { bestMinorPatch: newestMajor, newestMajor };
    }

    return { bestMinorPatch, newestMajor };
  }
}

/**
 * CLI Execution Logic
 */
export async function runCli() {
  const args = process.argv.slice(2);
  const daysArg = args.find(arg => arg.startsWith("--days="));
  const allowMajor = args.includes("--major");
  const delayDays = daysArg ? parseInt(daysArg.split("=")[1], 10) : 1;

  if (isNaN(delayDays)) {
    console.error("Error: --days must be a number (e.g., --days=3)");
    process.exit(1);
  }

  console.log(`maturity v__VERSION__ - Using ${delayDays} day(s) release delay safety.`);
  if (allowMajor) console.log("Major upgrades are ENABLED.");

  const core = new MaturityCore(delayDays);
  const pkgPath = path.join(process.cwd(), "package.json");
  
  let pkg;
  try {
    pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
  } catch (e) {
    console.error("Could not find or parse package.json in the current directory.");
    return;
  }

  let hasChanges = false;
  const majorUpgrades: string[] = [];
  const sections = ["dependencies", "devDependencies"];

  for (const section of sections) {
    if (!pkg[section]) continue;
    console.log(`\nChecking ${section}...`);
    
    for (const [name, range] of Object.entries(pkg[section])) {
      process.stdout.write(`  ${name}... `);
      const info = await core.getUpgradeInfo(name, range as string, allowMajor);
      
      if (info) {
        if (info.bestMinorPatch) {
          const prefix = (range as string).match(/^[\^~]/)?.[0] || "";
          const newRange = `${prefix}${info.bestMinorPatch}`;
          if (newRange !== range) {
            process.stdout.write(`UPDATING: ${range} -> ${newRange}\n`);
            pkg[section][name] = newRange;
            hasChanges = true;
          } else {
            process.stdout.write(`OK\n`);
          }
        } else {
          process.stdout.write(`OK\n`);
        }
        if (info.newestMajor) {
          majorUpgrades.push(`${name}: ${range} -> ${info.newestMajor}`);
        }
      } else {
        process.stdout.write(`FAILED\n`);
      }
    }
  }

  if (hasChanges) {
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    console.log("\npackage.json updated. Running npm install --legacy-peer-deps...");
    try {
      execSync("npm install --legacy-peer-deps", { stdio: "inherit" });
      console.log("Done.");
    } catch (e) {
      console.error("npm install failed. Please run manually.");
    }
  } else {
    console.log("\nNo minor/patch updates found.");
  }

  if (majorUpgrades.length > 0) {
    console.log("\n--- Available Major Upgrades (Skipped) ---");
    majorUpgrades.forEach(up => console.log(`[MAJOR] ${up}`));
    console.log("------------------------------------------");
    console.log("\nTo upgrade to a major version manually, run:");
    console.log("npm install <package>@latest --legacy-peer-deps");
  }
}

// Only run if called directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.endsWith("maturity") || process.argv[1]?.endsWith("index.js")) {
  runCli();
}
