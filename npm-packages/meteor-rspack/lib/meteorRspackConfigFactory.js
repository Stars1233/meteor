// meteorRspackConfigFactory.js

const { mergeSplitOverlap } = require("./mergeRulesSplitOverlap.js");

const DEFAULT_PREFIX = "meteorRspackConfig";
let counter = 0;

/**
 * Create a uniquely keyed Rspack config fragment.
 * Example return: { meteorRspackConfig1: { ...customConfig } }
 *
 * @param {object} customConfig
 * @param {{ key?: number|string, prefix?: string }} [opts]
 * @returns {Record<string, object>}
 */
function prepareMeteorRspackConfig(customConfig, opts = {}) {
  if (!customConfig || typeof customConfig !== "object") {
    throw new TypeError("customConfig must be an object");
  }
  const prefix = opts.prefix || DEFAULT_PREFIX;

  let name;
  if (opts.key != null) {
    const k = String(opts.key).trim();
    if (/^\d+$/.test(k)) name = `${prefix}${k}`;
    else if (k.startsWith(prefix) && /^\d+$/.test(k.slice(prefix.length)))
      name = k;
    else
      throw new Error(`opts.key must be a positive integer or "${prefix}<n>"`);

    const n = parseInt(name.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > counter) counter = n;
  } else {
    counter += 1;
    name = `${prefix}${counter}`;
  }

  return { [name]: customConfig };
}

/**
 * Merge all `{prefix}<n>` fragments into `config` using `mergeSplitOverlap`,
 * then remove those temporary keys. Mutates `config`.
 *
 * Order: fragments are applied in ascending numeric order (1, 2, 3, ...).
 *
 * @param {object} config
 * @param {{ prefix?: string }} [opts]
 * @returns {object} The same (mutated) config instance.
 */
function mergeMeteorRspackFragments(config, opts = {}) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new TypeError("config must be a plain object");
  }
  const prefix = opts.prefix || DEFAULT_PREFIX;

  // Collect fragment keys like "meteorRspackConfig12"
  const tempKeys = Object.keys(config)
    .filter((k) => k.startsWith(prefix) && /^\d+$/.test(k.slice(prefix.length)))
    .map((k) => [k, parseInt(k.slice(prefix.length), 10)])
    .sort((a, b) => a[1] - b[1])
    .map(([k]) => k);

  if (tempKeys.length === 0) return config;

  // Apply each fragment with your merge policy
  for (const k of tempKeys) {
    const fragment = config[k];
    if (!fragment || typeof fragment !== "object" || Array.isArray(fragment)) {
      throw new Error(`Fragment "${k}" must be a plain object`);
    }
    const merged = mergeSplitOverlap(config, fragment);

    // Keep object identity: replace contents of `config` with `merged`
    replaceObject(config, merged);
  }

  // Strip the temp keys at the end
  for (const k of tempKeys) delete config[k];

  return config;
}

function replaceObject(target, source) {
  for (const key of Object.keys(target)) {
    if (!(key in source)) delete target[key];
  }
  for (const key of Object.keys(source)) {
    target[key] = source[key];
  }
}

module.exports = {
  prepareMeteorRspackConfig,
  mergeMeteorRspackFragments,
};
