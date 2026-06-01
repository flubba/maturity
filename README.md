# maturity

A local, branch-less dependency updater for Node.js projects with a built-in safety release delay.

## Why maturity?

Most dependency updaters (like Renovate or Dependabot) are designed as server-side services. `maturity` is a lightweight CLI tool designed to run locally, updating your `package.json` directly without creating branches.

### Security First

In recent years, the npm ecosystem has seen an increase in **supply-chain attacks**, where popular packages are compromised to include malware. These malicious versions are often detected and pulled from the registry within hours or a few days.

`maturity` protects you by enforcing a **Release Delay**: It only suggests updates for versions that have been out for at least **1 day** (configurable). This "cooldown period" ensures that you don't accidentally install a freshly compromised version before the community or security audits have had a chance to flag it.

## Features

- **Local-first**: No remote platform required.
- **Safety Delay**: Only updates to versions at least 1 day old (default).
- **Customizable**: Use `--days=N` to change the safety window.
- **Major Upgrades**: Optional support for major versions via `--major`.
- **Major Safety**: Automatically stays within the same major version by default.
- **Major Reporting**: Shows you available major upgrades at the end of the run.
- **Peer Dependency Friendly**: Uses `--legacy-peer-deps` to handle complex dependency trees.

## Installation

```bash
# Run without installing
npx maturity

# Or install globally
npm install -g maturity
```

## Usage

Simply run the command in your project root:

```bash
maturity
```

### Customizing the Delay

To use a 3-day delay instead of the default 1 day:

```bash
maturity --days=3
```

### Allowing Major Upgrades

By default, `maturity` only suggests minor and patch updates. To allow major upgrades (e.g., v5 -> v6):

```bash
maturity --major
```

## Integration in package.json

Add it to your `scripts` to make it part of your workflow:

```json
{
  "scripts": {
    "update": "maturity --days=3"
  }
}
```

Now you can just run `npm run update`.

## How it works

1. Reads your `package.json`.
2. Fetches metadata from the npm registry for each dependency.
3. Identifies the latest version released within your safety window (default: 1 day).
4. Updates `package.json` if a newer "mature" version is found.
5. Runs `npm install --legacy-peer-deps` to update your lockfile.

## License

MIT
