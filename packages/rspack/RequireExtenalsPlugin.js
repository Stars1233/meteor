// RequireExternalsPlugin.js

const fs = require('fs');
const path = require('path');

class RequireExternalsPlugin {
  constructor({ buildContext, filePath } = {}) {
    this.pluginName = 'RequireExternalsPlugin';
    this._prefix = 'external ';
    this._prefixLen = this._prefix.length;
    this._buildContext = buildContext;
    this.filePath = path.resolve(
      process.cwd(),
      buildContext,
      filePath
    );

    // Initialize funcCount based on existing helpers in the file
    this._funcCount = this._computeNextFuncCount();
  }

  apply(compiler) {
    compiler.hooks.done.tap({ name: this.pluginName, stage: -10 }, (stats) => {
      // 1) Ensure globalThis.module / exports block is present
      this._ensureGlobalThisModule();

      // 2) Re-load existing requires from disk on every run
      const existing = this._readExistingRequires();

      // 2a) Compute the *current* externals in this build
      const info = stats.toJson({ modules: true });
      const current = new Set();
      for (const m of info.modules) {
        if (typeof m.name === 'string' && m.name.startsWith(this._prefix)) {
          let pkg = m.name.slice(this._prefixLen);
          if (pkg.startsWith('"') && pkg.endsWith('"')) pkg = pkg.slice(1, -1);
          current.add(pkg);
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
        if (typeof name !== 'string' || !name.startsWith(this._prefix)) continue;
        let pkg = name.slice(this._prefixLen);
        if (pkg.startsWith('"') && pkg.endsWith('"')) pkg = pkg.slice(1, -1);
        if (!existing.has(pkg)) {
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
