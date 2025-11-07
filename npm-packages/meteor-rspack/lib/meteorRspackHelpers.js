const path = require("path");
const { prepareMeteorRspackConfig } = require("./meteorRspackConfigFactory");
const { builtinModules } = require("module");

/**
 * Resolve a package directory from node resolution.
 * @param {string} pkg
 * @returns {string} absolute directory of the package
 */
function pkgDir(pkg) {
  const resolved = require.resolve(`${pkg}/package.json`, {
    paths: [process.cwd()],
  });
  return path.dirname(resolved);
}

/**
 * Wrap externals for Meteor runtime (marks deps as externals).
 * Usage: compileWithMeteor(["sharp", "vimeo", "fs"])
 *
 * @param {string[]} deps - package names or module IDs
 * @returns {Record<string, object>} `{ meteorRspackConfigX: { externals: [...] } }`
 */
function compileWithMeteor(deps) {
  const flat = deps.flat().filter(Boolean);
  return prepareMeteorRspackConfig({
    externals: flat,
  });
}

/**
 * Add SWC transpilation rules limited to specific deps (monorepo-friendly).
 * Usage: compileWithRspack(["@org/lib-a", "zod"])
 *
 * Requires global `Meteor.swcConfigOptions` (as in your setup).
 *
 * @param {string[]} deps - package names to include in SWC loader
 * @returns {Record<string, object>} `{ meteorRspackConfigX: { module: { rules: [...] } } }`
 */
function compileWithRspack(deps, { options = {} } = {}) {
  const includeDirs = deps.flat().filter(Boolean).map(pkgDir);

  return prepareMeteorRspackConfig({
    module: {
      rules: [
        {
          test: /\.(?:[mc]?js|jsx|[mc]?ts|tsx)$/i,
          include: includeDirs,
          loader: "builtin:swc-loader",
          options,
        },
      ],
    },
  });
}

/**
 * Enable or disable Rspack cache config
 * Usage: setCache(false)
 *
 * @param {boolean} enabled
 * @param {Record<string, object>} cacheConfig
 * @returns {Record<string, object>} `{ meteorRspackConfigX: { cache: {} } }`
 */
function setCache(
  enabled,
  cacheConfig = { cache: true, experiments: { cache: true } }
) {
  return prepareMeteorRspackConfig(
    enabled
      ? cacheConfig
      : {
          cache: false, // disable cache
          experiments: {
            cache: false, // disable persistent cache (experimental flag)
          },
        }
  );
}

/**
 * Build an alias map that disables ALL Node core modules in a web build.
 * - Includes both 'fs' and 'node:fs' keys
 * - Optional extras let you block non-core modules too
 */
function makeWebNodeBuiltinsAlias(extras = []) {
  // Node core list, normalized (strip `node:` prefix)
  const core = new Set(builtinModules.map((m) => m.replace(/^node:/, "")));

  // browser-safe allowlist (these we *don't* mark as false)
  const allowlist = new Set([
    "process",
    "util",
    "events",
    "path",
    "stream",
    "assert",
    "assert/strict",
  ]);

  const names = new Set();
  for (const m of core) {
    // Add both 'fs' and 'node:fs' variants
    names.add(m);
    names.add(`node:${m}`);
  }
  for (const x of extras) names.add(x);

  // ❌ Everything except the allowlist gets mapped to false
  const entries = [...names]
    .filter((m) => !allowlist.has(m.replace(/^node:/, "")))
    .map((m) => [m, false]);

  return Object.fromEntries(entries);
}

/**
 * Enable Rspack split vendor chunk config
 * Usage: splitVendorChunk()
 *
 * @returns {Record<string, object>} `{ meteorRspackConfigX: { optimization: { ... } } }`
 */
function splitVendorChunk() {
  return prepareMeteorRspackConfig({
    optimization: {
      splitChunks: {
        chunks: "all", // split both sync and async imports
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendor",
            enforce: true,
            priority: 10,
            chunks: "all",
          },
        },
      },
    },
  });
}

module.exports = {
  compileWithMeteor,
  compileWithRspack,
  setCache,
  splitVendorChunk,
  makeWebNodeBuiltinsAlias,
};
