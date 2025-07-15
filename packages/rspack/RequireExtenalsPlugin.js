// RequireExternalsPlugin.js
//
// This plugin prepare the require of externals used to be lazy required by Meteor bundler.
//
// It can describe additional externals using the externals option by array, RegExp or function.
// These externals will be lazy required as well, and optionally could be resolved using
// the externalMap function if provided.
// Used for Blaze to translate require of html files to require of js files bundled by Meteor.

const fs = require('fs');
const path = require('path');

class RequireExternalsPlugin {
  constructor({
    filePath,
    // Externals can be:
    // - An array of strings: module name must be included in the array
    // - A RegExp: module name must match the regex
    // - A function: function(name) must return true for the module name
    externals = null,
    // ExternalMap is a function that receives the request object and returns the external request path
    // It can be used to customize how external modules are mapped to file paths
    // If not provided, the default behavior is to map the external module name.
    externalMap = null
  } = {}) {
    this.pluginName = 'RequireExternalsPlugin';

    // Prepare externals
    this._externals = externals;
    this._externalMap = externalMap;
    this._defaultExternalPrefix = 'external ';

    // Prepare paths
    this.filePath = path.resolve(process.cwd(), filePath);
    this.backRoot = '../'.repeat(
      filePath.replace(/^\.?\/+/, '').split('/').length - 1
    );

    // Initialize funcCount based on existing helpers in the file
    this._funcCount = this._computeNextFuncCount();
  }

  // Helper method to check if a module name matches the externals or default prefix
  _isExternalModule(name) {
    if (typeof name !== 'string') return false;

    // Check externals if provided
    if (this._externals) {
      // If externals is an array, use includes method
      if (Array.isArray(this._externals)) {
        if (this._externals.includes(name)) {
          return { isExternal: true, type: 'externals', value: name };
        }
      }
      // If externals is a RegExp, use test method
      else if (this._externals instanceof RegExp) {
        if (this._externals.test(name)) {
          return { isExternal: true, type: 'externals', value: name };
        }
      }
      // If externals is a function, call it with the name
      else if (typeof this._externals === 'function') {
        if (this._externals(name)) {
          return { isExternal: true, type: 'externals', value: name };
        }
      }
    }

    if (name.startsWith(this._defaultExternalPrefix)) {
      return { isExternal: true, type: 'prefix', value: name };
    }

    return { isExternal: false };
  }

  // Helper method to extract package name from module name
  _extractPackageName(name) {
    let pkg = name.slice(this._defaultExternalPrefix.length);
    if (pkg.startsWith('"') && pkg.endsWith('"')) pkg = pkg.slice(1, -1);

    // If the extracted package name is a path, use the path as is
    if (
      pkg &&
      (path.isAbsolute(pkg) || pkg.startsWith('./') || pkg.startsWith('../'))
    ) {
      const module = this.moduleMeta.get(pkg);
      if (module) {
        return `${this.backRoot}${module.relativeRequest}`;
      }
      return `${this.backRoot}${name}`;
    }

    return pkg;
  }

  apply(compiler) {
    // Initialize moduleMeta if it doesn't exist
    this.moduleMeta = this.moduleMeta || new Map();

    // Only set compiler.options.externals if both externals and externalMap are defined
    if (this._externals && this._externalMap) {
      compiler.options.externals = [
        ...compiler.options.externals || [],
        (module, callback) => {
          const { request, context } = module;
          const matchInfo = this._isExternalModule(request);
          if (matchInfo.isExternal) {

            let externalRequest;
            // Use externalMap function if provided
            if (this._externalMap && typeof this._externalMap === 'function') {
              externalRequest = this._externalMap(module);

              const relContext = path.relative(process.cwd(), context);
              // Store the original request to resolve properly the lazy html require later
              this.moduleMeta.set(externalRequest, {
                originalRequest: request,
                externalRequest,
                relativeRequest: path.join(relContext, request),
              });

              // tell Rspack "don't bundle this, import it at runtime"
              return callback(null, externalRequest);
            }
          }

          callback(); // otherwise normal resolution
        }
      ];
    }

    compiler.hooks.done.tap({ name: this.pluginName, stage: -10 }, (stats) => {
      // 1) Ensure globalThis.module / exports block is present
      this._ensureGlobalThisModule();

      // 2) Re-load existing requires from disk on every run
      const existing = this._readExistingRequires();

      // 2a) Compute the *current* externals in this build
      const info = stats.toJson({ modules: true });
      const current = new Set();
      for (const m of info.modules) {
        const matchInfo = this._isExternalModule(m.name);
        if (matchInfo.isExternal) {
          const pkg = this._extractPackageName(m.name, matchInfo);
          if (pkg) {
            current.add(pkg);
          }
        }
      }

      // 2b) Remove any requires that are no longer in `current`
      const toRemove = [...existing].filter(p => !current.has(p));
      if (toRemove.length) {
        let content = fs.readFileSync(this.filePath, 'utf-8');

        // Strip stale require(...) lines
        for (const pkg of toRemove) {
          const re = new RegExp(`^.*require\\('${pkg}'\\);?.*(\\r?\\n)?`, 'gm');
          content = content.replace(re, '');
        }

        // Strip out any now-empty helper functions:
        //   function lazyExternalImportsX() {
        //   }
        const emptyFnRe = /^function\s+lazyExternalImports\d+\s*\(\)\s*{\s*}\s*(\r?\n)?/gm;
        content = content.replace(emptyFnRe, '');

        // Write the cleaned file back
        fs.writeFileSync(this.filePath, content, 'utf-8');

        // Re-populate `existing` so the add-diff is accurate
        existing.clear();
        for (const match of content.matchAll(/require\('([^']+)'\)/g)) {
          existing.add(match[1]);
        }
      }

      // 3) Collect any new externals from this build
      const newRequires = [];
      for (const module of info.modules) {
        const name = module.name;
        const matchInfo = this._isExternalModule(name);
        if (!matchInfo.isExternal) continue;

        const pkg = this._extractPackageName(name, matchInfo);
        if (pkg && !existing.has(pkg)) {
          existing.add(pkg);
          newRequires.push(`require('${pkg}')`);
        }
      }

      // 4) Append new imports if any
      if (newRequires.length) {
        const fnName = `lazyExternalImports${this._funcCount++}`;
        const body = newRequires.map(req => `  ${req};`).join('\n');
        const fnCode = `\nfunction ${fnName}() {\n${body}\n}\n`;
        try {
          fs.appendFileSync(this.filePath, fnCode);
        } catch (err) {
          console.error(`Failed to append imports to ${this.filePath}:`, err);
        }
      }
    });
  }

  _computeNextFuncCount() {
    let max = 0;
    if (fs.existsSync(this.filePath)) {
      try {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        const fnRe = /function\s+lazyExternalImports(\d+)\s*\(\)/g;
        let match;
        while ((match = fnRe.exec(content)) !== null) {
          const n = parseInt(match[1], 10);
          if (n > max) max = n;
        }
      } catch {
        // ignore read errors
      }
    }
    // next count is max found plus one
    return max + 1;
  }

  _ensureGlobalThisModule() {
    const block = [
      `/* Polyfill globalThis.module & exports */`,
      `if (typeof globalThis.module === 'undefined') {`,
      `  globalThis.module = { exports: {} };`,
      `}`,
      `if (typeof globalThis.exports === 'undefined') {`,
      `  globalThis.exports = globalThis.module.exports;`,
      `}`
    ].join('\n') + '\n';

    let content = '';
    if (fs.existsSync(this.filePath)) {
      content = fs.readFileSync(this.filePath, 'utf-8');
      if (!content.includes(`typeof globalThis.module === 'undefined'`)) {
        // Prepend so it lives at the very top
        fs.writeFileSync(this.filePath, content + '\n' + block, 'utf-8');
      }
    } else {
      // File doesn’t exist yet: create with just the block
      fs.writeFileSync(this.filePath, block, 'utf-8');
    }
  }

  _readExistingRequires() {
    const existing = new Set();
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      const requireRegex = /require\('([^']+)'\)/g;
      let match;
      while ((match = requireRegex.exec(content)) !== null) {
        existing.add(match[1]);
      }
    } catch {
      // ignore if file missing or unreadable
    }
    return existing;
  }
}

module.exports = RequireExternalsPlugin;
