/**
 * Utilities for merging webpack/rspack configurations with special handling for
 * overlapping file extensions in module rules.
 */

import { mergeWithCustomize } from 'webpack-merge';

/**
 * File extensions to check when determining rule overlaps.
 */
export const EXT_CATALOG = [
  '.tsx', '.ts', '.mts', '.cts',
  '.jsx', '.js', '.mjs', '.cjs',
];

/**
 * Converts rule.test to predicate functions.
 * @param {Object} rule - Rule object
 * @returns {Function[]} Predicate functions
 */
function testsFrom(rule) {
  const t = rule.test;
  if (!t) return [() => true]; // no test means match all; you can tighten if you want
  const arr = Array.isArray(t) ? t : [t];
  return arr.map(el => {
    if (el instanceof RegExp) return (s) => el.test(s);
    if (typeof el === 'function') return el;
    if (typeof el === 'string') {
      // Webpack allows string match; treat as substring
      return (s) => s.includes(el);
    }
    return () => false;
  });
}

/**
 * Checks if rule matches a file extension.
 * @param {Object} rule - Rule object
 * @param {string} ext - File extension
 * @returns {boolean} True if matches
 */
function ruleMatchesExt(rule, ext) {
  // simulate a filename to test against
  const filename = `x${ext}`;
  const preds = testsFrom(rule);
  return preds.some(fn => {
    try { return !!fn(filename); } catch { return false; }
  });
}

/**
 * Creates regex for matching file extensions.
 * @param {string[]} exts - File extensions
 * @returns {RegExp} Regex like /\.(js|jsx)$/
 */
function regexFromExts(exts) {
  const body = exts.map(e => e.replace(/^\./, '')).join('|');
  return new RegExp(`\\.(${body})$`, 'i');
}

/**
 * Clones rule with new test property.
 * @param {Object} rule - Rule to clone
 * @param {RegExp|Function|string} newTest - New test value
 * @returns {Object} Cloned rule
 */
function cloneWithTest(rule, newTest) {
  return { ...rule, test: newTest };
}

/**
 * Merges rules with special handling for overlapping extensions.
 * - Replaces overlapping parts with B rules
 * - Preserves non-overlapping parts from A rules
 * 
 * @param {Array} aRules - Base rules
 * @param {Array} bRules - Rules to merge in
 * @returns {Array} Merged rules
 */
function splitOverlapRulesMerge(aRules, bRules) {
  const result = [...aRules];

  for (const bRule of bRules) {
    // Try to find an A rule that overlaps B by extensions
    let replaced = false;

    for (let i = 0; i < result.length; i++) {
      const aRule = result[i];

      // Determine which extensions each rule matches (within our catalog)
      const aExts = EXT_CATALOG.filter(ext => ruleMatchesExt(aRule, ext));
      const bExts = EXT_CATALOG.filter(ext => ruleMatchesExt(bRule, ext));

      if (aExts.length === 0 || bExts.length === 0) {
        continue; // nothing meaningful to compare in our catalog
      }

      const overlap = aExts.filter(e => bExts.includes(e));
      if (overlap.length === 0) continue;

      // 1) Replace the overlapping A rule with B
      result[i] = bRule;

      // 2) Add a "residual" A rule for the non-overlapping extensions
      const residual = aExts.filter(e => !overlap.includes(e));
      if (residual.length > 0) {
        const residualRule = cloneWithTest(aRule, regexFromExts(residual));
        result.splice(i, 0, residualRule); // keep residual before B, or after—your choice
        i++; // skip over the newly inserted residual
      }

      replaced = true;
      break;
    }

    // If we didn’t overlap with any A rule, just add B
    if (!replaced) {
      result.push(bRule);
    }
  }

  return result;
}

/**
 * Merges webpack/rspack configs with smart handling of overlapping rules.
 *
 * @param {...Object} configs - Configs to merge
 * @returns {Object} Merged config
 */
export function mergeSplitOverlap(...configs) {
  return mergeWithCustomize({
    customizeArray(a, b, key) {
      if (key === 'module.rules') {
        const aRules = Array.isArray(a) ? a : [];
        const bRules = Array.isArray(b) ? b : [];
        return splitOverlapRulesMerge(aRules, bRules);
      }
      // fall through to default merging
      return undefined;
    }
  })(...configs);
}
