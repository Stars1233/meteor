// RequireExternalsPlugin.js

const fs = require('fs');
const path = require('path');

class RequireExternalsPlugin {
  constructor({ buildContext } = {}) {
    this.pluginName = 'RequireExternalsPlugin';
    this.imports = new Set();
    this._prefix = 'external ';
    this._prefixLen = this._prefix.length;
    this._funcCount = 1;            // start your counter at 1
    this._buildContext = buildContext;

    // Determine output file path
    this.filePath = path.resolve(
      process.cwd(),
      buildContext,
      `main-client.dev.js`
    );

    // Initialize existing imports from file via single regex pass
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      const requireRegex = /require\('([^']+)'\)/g;
      let match;
      while ((match = requireRegex.exec(content)) !== null) {
        this.imports.add(match[1]);
      }
    } catch {
      // file not found or unreadable: start fresh
    }
  }

  apply(compiler) {
    compiler.hooks.done.tap(this.pluginName, (stats) => {
      const info = stats.toJson({ modules: true });

      const existing = this.imports;
      const { _prefix: prefix, _prefixLen: prefixLen } = this;
      const newRequires = [];

      // single-pass over modules, avoid toJson()
      for (const module of info.modules) {
        const name = module.name;
        if (typeof name !== 'string' || !name.startsWith(prefix)) continue;

        let pkg = name.slice(prefixLen);
        if (pkg[0] === '"' && pkg[pkg.length - 1] === '"') {
          pkg = pkg.slice(1, -1);
        }

        if (!existing.has(pkg)) {
          existing.add(pkg);
          newRequires.push(`require('${pkg}')`);
        }
      }

      if (newRequires.length) {
        // generate a unique function name
        const fnName = `lazyExternalImports${this._funcCount++}`;

        // indent each require call and terminate with semicolon
        const body = newRequires
          .map(req => `  ${req};`)
          .join('\n');

        // wrap in a function
        const fnCode = `function ${fnName}() {\n${body}\n}`;

        try {
          fs.appendFileSync(this.filePath, `\n${fnCode}\n`);
        } catch (err) {
          console.error(`Failed to append imports to ${this.filePath}:`, err);
        }
      }
    });
  }
}

module.exports = RequireExternalsPlugin;
