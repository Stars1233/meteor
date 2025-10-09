const path = require("path");
const { prepareMeteorRspackConfig } = require("./meteorRspackConfigFactory");

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

module.exports = {
  compileWithMeteor,
  compileWithRspack,
};
