import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

let cachedBinDir: string | null = null;

/**
 * Returns the directory containing the openspec shim scripts.
 * Dev: apps/desktop/resources/openspec/bin/
 * Packaged: {resourcesPath}/openspec/bin/
 */
export function getOpenspecBinDir(): string {
  if (cachedBinDir !== null) return cachedBinDir;

  const isDev = !app.isPackaged;
  const dir = isDev
    ? path.join(app.getAppPath(), 'resources', 'openspec', 'bin')
    : path.join(process.resourcesPath, 'openspec', 'bin');

  if (!fs.existsSync(dir)) {
    console.warn(`[openspec-bin] Shim directory not found: ${dir}`);
    console.warn("[openspec-bin] Run 'bun run openspec:install' to install the bundled CLI");
  } else {
    console.log(`[openspec-bin] Resolved shim directory: ${dir}`);
  }

  cachedBinDir = dir;
  return dir;
}

/**
 * Env var overrides to inject when spawning agent CLIs so the openspec shim works.
 * - CSCODE_ELECTRON_PATH: path the shim execs with ELECTRON_RUN_AS_NODE=1
 * - OPENSPEC_TELEMETRY: disabled to prevent PostHog traffic from inside the app
 */
export function buildOpenspecEnvOverrides(): Record<string, string> {
  return {
    CSCODE_ELECTRON_PATH: process.execPath,
    OPENSPEC_TELEMETRY: '0',
    DO_NOT_TRACK: '1',
    CI: 'true'
  };
}
