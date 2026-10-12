/**
 * Guarantees the published package is self-contained: every relative import
 * reachable from shipped files resolves to a file that is itself shipped.
 * Guards against the 0.19.0 breakage where `server/subscriptions.js`
 * imported `app/data/subscription-key.js` while the `files` whitelist
 * omitted it, crashing the published CLI at startup.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PKG = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

/**
 * Collect repo-relative file paths under `dir` recursively, skipping test
 * files as npm's test-file exclusion in the `files` whitelist does.
 *
 * @param {string} dir - Repo-relative directory path
 * @returns {string[]} Repo-relative file paths
 */
function collectShippedFilesUnder(dir) {
  const abs = path.join(ROOT, dir);
  const out = [];
  for (const name of readdirSync(abs)) {
    const rel = path.posix.join(dir, name);
    const child = path.join(abs, name);
    if (statSync(child).isDirectory()) {
      out.push(...collectShippedFilesUnder(rel));
    } else if (!rel.endsWith('.test.js')) {
      out.push(rel);
    }
  }
  return out;
}

/**
 * Expand the `files` whitelist into the concrete set of repo-relative paths
 * npm packs. Entries missing on disk (e.g. an ungenerated `.map`) are
 * skipped, mirroring npm's behavior.
 *
 * @returns {Set<string>} Repo-relative shipped file paths
 */
function expandFilesWhitelist() {
  const shipped = new Set();
  for (const entry of PKG.files) {
    if (entry.startsWith('!')) {
      continue;
    }
    const abs = path.join(ROOT, entry);
    if (!existsSync(abs)) {
      continue;
    }
    if (statSync(abs).isDirectory()) {
      for (const rel of collectShippedFilesUnder(entry)) {
        shipped.add(rel);
      }
    } else {
      shipped.add(entry);
    }
  }
  return shipped;
}

/**
 * Extract relative import specifiers from a source file. Matches static
 * `import ... from '...'`, re-exports, dynamic `import('...')`, and JSDoc
 * `@import ... from '...'` references.
 *
 * @param {string} file - Absolute path to a JavaScript source file
 * @returns {string[]} Relative import specifiers
 */
function relativeImportsOf(file) {
  const source = readFileSync(file, 'utf8');
  const pattern = /(?:\bfrom\s*|\bimport\s*\(\s*)['"](\.\.?\/[^'"]+)['"]/g;
  const specs = [];
  for (const match of source.matchAll(pattern)) {
    specs.push(match[1]);
  }
  return specs;
}

describe('package files whitelist', () => {
  test('ships every file imported by shipped runtime code', () => {
    const shipped = expandFilesWhitelist();
    const missing = [];

    for (const file of shipped) {
      if (!file.endsWith('.js')) {
        continue;
      }
      for (const spec of relativeImportsOf(path.join(ROOT, file))) {
        const abs = path.resolve(path.dirname(path.join(ROOT, file)), spec);
        const target = path.relative(ROOT, abs);
        if (!shipped.has(target)) {
          missing.push(`${file} imports ${spec}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
