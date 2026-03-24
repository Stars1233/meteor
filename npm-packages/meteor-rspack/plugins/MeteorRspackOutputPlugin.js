// MeteorRspackOutputPlugin.js
//
// This plugin outputs a JSON stringified with a tag delimiter each time
// a new Rspack compilation happens. The JSON content is configurable
// via plugin instantiation options.

const { outputMeteorRspack } = require('../lib/meteorRspackHelpers');

/**
 * Extracts file extensions that rspack is configured to handle
 * from the resolved module.rules test patterns.
 * Only returns extensions relevant for Meteor delegation (CSS-family).
 * @param {import('@rspack/core').Compiler} compiler
 * @returns {string[]} Array of extensions like ['.css', '.less', '.scss']
 */
function extractDelegatedExtensions(compiler) {
  const delegatableExtensions = ['.css', '.less', '.scss', '.sass', '.styl'];
  const found = new Set();

  function inspectRules(rules) {
    for (const rule of rules) {
      if (!rule) continue;
      if (rule.test) {
        const testStr = rule.test instanceof RegExp
          ? rule.test.source
          : String(rule.test);
        for (const ext of delegatableExtensions) {
          const escaped = ext.replace('.', '\\.');
          if (testStr.includes(escaped)) {
            found.add(ext);
          }
        }
      }
      if (rule.oneOf) inspectRules(rule.oneOf);
      if (rule.rules) inspectRules(rule.rules);
    }
  }

  inspectRules(compiler.options.module?.rules || []);
  return Array.from(found);
}

class MeteorRspackOutputPlugin {
  constructor(options = {}) {
    this.pluginName = 'MeteorRspackOutputPlugin';
    this.options = options;
    this.compilationCount = 0;
    // The data to be output as JSON, can be a static object or a function
    this.getData =
      typeof options.getData === 'function'
        ? options.getData
        : () => options.data || {};
  }

  apply(compiler) {
    // Hook into the 'done' event which fires after each compilation completes
    compiler.hooks.done.tap(this.pluginName, stats => {
      this.compilationCount++;
      const data = {
        ...(this.getData(stats, {
          compilationCount: this.compilationCount,
          isRebuild: this.compilationCount > 1,
          compiler,
        }) || {}),
      };
      outputMeteorRspack(data);
    });
  }
}

module.exports = { MeteorRspackOutputPlugin, extractDelegatedExtensions };
