#!/usr/bin/env node

/**
 * Script to create a Meteor test app for manual testing without automatic cleanup.
 *
 * Sources apps from:
 *   - tools/modern-tests/apps/<name>  (use --app flag)
 *   - meteor create --<skeleton>      (use --skeleton flag)
 *
 * Usage:
 *   npm run create-app:modern -- --app react
 *   npm run create-app:modern -- --app react --output ./dist/my-react-app
 *   npm run create-app:modern -- --app monorepo --monorepo
 *   npm run create-app:modern -- --skeleton react
 *   npm run create-app:modern -- --skeleton react --output ./my-apps/custom-name
 */

const path = require('path');
const fs = require('fs-extra');
const execa = require('execa');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const METEOR_EXECUTABLE = path.join(REPO_ROOT, 'meteor');
const MODERN_TESTS_DIR = path.join(__dirname, '..');
const APPS_DIR = path.join(MODERN_TESTS_DIR, 'apps');
const DEFAULT_OUTPUT_DIR = path.join(REPO_ROOT, 'dist');

function parseArgs(argv) {
  const args = { monorepo: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--app') {
      args.app = argv[++i];
    } else if (argv[i] === '--skeleton') {
      args.skeleton = argv[++i];
    } else if (argv[i] === '--output') {
      args.output = argv[++i];
    } else if (argv[i] === '--monorepo') {
      args.monorepo = true;
    } else if (argv[i] === '--force' || argv[i] === '-f') {
      args.force = true;
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  const availableApps = fs.existsSync(APPS_DIR)
    ? fs.readdirSync(APPS_DIR).join(', ')
    : '(none found)';

  console.log(`
Usage: npm run create-app:modern -- [options]

Options:
  --app <name>       Copy an existing app from tools/modern-tests/apps/
  --skeleton <name>  Create a new app via "meteor create --<name>"
  --output <path>    Full destination path for the app (default: ./dist/<appName>)
  --monorepo         Treat the app as a monorepo (runs npm install at both root and app/ levels)
  --force, -f        Remove the destination directory if it already exists before creating the app
  --help, -h         Show this help message

Available apps: ${availableApps}

Examples:
  npm run create-app:modern -- --app react
  npm run create-app:modern -- --app react --output ./dist/my-react-app
  npm run create-app:modern -- --app monorepo --monorepo
  npm run create-app:modern -- --skeleton react
  npm run create-app:modern -- --skeleton react --output ./my-apps/custom-name
`);
}

/**
 * Find a test-helper function call block (e.g., testMeteorSkeleton({ skeletonName: 'react', ... }))
 * that contains a matching name key/value, and return the content of its options object.
 */
function findTestHelperBlock(content, fnName, nameKey, nameValue) {
  let searchStart = 0;

  while (searchStart < content.length) {
    const fnIdx = content.indexOf(fnName + '(', searchStart);
    if (fnIdx === -1) return null;

    const braceIdx = content.indexOf('{', fnIdx + fnName.length);
    if (braceIdx === -1) return null;

    // Find matching closing brace
    let depth = 0;
    let endIdx = -1;
    for (let i = braceIdx; i < content.length; i++) {
      if (content[i] === '{') depth++;
      else if (content[i] === '}') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }

    if (endIdx !== -1) {
      const block = content.substring(braceIdx, endIdx + 1);
      const namePattern = new RegExp(`${nameKey}:\\s*['"]${nameValue}['"]`);
      if (namePattern.test(block)) {
        return block;
      }
    }

    searchStart = endIdx !== -1 ? endIdx + 1 : fnIdx + 1;
  }

  return null;
}

/**
 * Parse environment variable patterns from a code string.
 * Matches:
 *   - process.env.KEY = 'value'  (non-empty string values only)
 *   - env: { KEY: 'value', ... }
 * Only includes envs that have an actual non-empty value.
 */
function parseEnvVars(code) {
  const envVars = {};

  // Pattern 1: process.env.KEY = 'value' or "value" (non-empty values only)
  const processEnvRegex = /process\.env\.(\w+)\s*=\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = processEnvRegex.exec(code)) !== null) {
    envVars[match[1]] = match[2];
  }

  // Pattern 2: env: { KEY: 'value', ... }
  const envObjRegex = /\benv:\s*\{([^}]+)\}/g;
  while ((match = envObjRegex.exec(code)) !== null) {
    const envContent = match[1];
    const kvRegex = /(\w+)\s*:\s*['"]([^'"]+)['"]/g;
    let kvMatch;
    while ((kvMatch = kvRegex.exec(envContent)) !== null) {
      envVars[kvMatch[1]] = kvMatch[2];
    }
  }

  return envVars;
}

/**
 * Read the corresponding test file for an app or skeleton and extract
 * environment variables that the tests set (so the manually created app
 * behaves the same way).
 *
 * For --app <name>:  reads tools/modern-tests/<name>.test.js (whole file)
 * For --skeleton <name>: reads tools/modern-tests/skeleton.test.js and
 *   scopes to the testMeteorSkeleton({ skeletonName: '<name>' }) block.
 */
function extractEnvVarsFromTestFile(sourceName, isApp) {
  const testFile = isApp
    ? path.join(MODERN_TESTS_DIR, `${sourceName}.test.js`)
    : path.join(MODERN_TESTS_DIR, 'skeleton.test.js');

  if (!fs.existsSync(testFile)) return {};

  const content = fs.readFileSync(testFile, 'utf8');
  let scope;

  if (isApp) {
    scope = content;
  } else {
    scope = findTestHelperBlock(content, 'testMeteorSkeleton', 'skeletonName', sourceName);
    if (!scope) return {};
  }

  return parseEnvVars(scope);
}

/**
 * Build a shell env prefix string from an env vars object.
 * e.g., { METEOR_LOCAL_DIR: '.meteor/local-custom' } => "METEOR_LOCAL_DIR=.meteor/local-custom"
 */
function buildEnvPrefix(envVars) {
  const entries = Object.entries(envVars);
  if (entries.length === 0) return '';
  return entries.map(([key, value]) => `${key}=${value}`).join(' ');
}

/**
 * Replace bare `meteor` command occurrences in a script string with the full
 * checkout path. Matches `meteor` only as a standalone command word:
 *   - not preceded by `/` or a word character (avoids already-resolved paths
 *     and things like `something-meteor`)
 *   - not followed by a word character (avoids `meteor-node-stubs` etc.)
 */
function rewriteMeteorCmd(scriptValue, meteorExecutable) {
  return scriptValue.replace(/(?<![/\w])meteor(?![\w-])/g, meteorExecutable);
}

/**
 * Read the package.json at the given path, rewrite all existing scripts to use
 * the checkout meteor binary, inject additional scripts (prefixed with any
 * environment variables extracted from the corresponding test file), and write
 * it back.
 */
async function injectNpmScripts(packageJsonPath, envVars = {}) {
  const pkg = await fs.readJson(packageJsonPath);
  const meteorConfig = pkg.meteor || {};
  const hasTestModule = !!meteorConfig.testModule;
  const hasClient = !!(meteorConfig.mainModule && meteorConfig.mainModule.client);
  const m = METEOR_EXECUTABLE;
  const envPrefix = buildEnvPrefix(envVars);
  const p = envPrefix ? `${envPrefix} ` : '';

  // Rewrite ALL existing scripts: replace bare `meteor` with the checkout path
  const scripts = {};
  for (const [key, value] of Object.entries(pkg.scripts || {})) {
    scripts[key] = rewriteMeteorCmd(value, m);
  }

  // Add/overwrite canonical scripts using the checkout path
  scripts['start'] = `${p}${m} run`;
  scripts['start:prod'] = `${p}${m} run --production`;
  scripts['build'] = `${p}${m} build ./_build --directory`;
  scripts['visualize'] = `${p}${m} run --production --extra-packages bundle-visualizer`;

  if (hasTestModule) {
    scripts['test'] = `${p}${m} test --once --driver-package meteortesting:mocha`;
    scripts['test:watch'] = `${p}${m} test --driver-package meteortesting:mocha`;

    if (hasClient) {
      scripts['test:full-app'] = `${p}${m} test --full-app --once --driver-package meteortesting:mocha`;
      scripts['test:full-app:watch'] = `${p}TEST_WATCH=1 ${m} test --full-app --driver-package meteortesting:mocha`;
    }
  }

  pkg.scripts = scripts;
  await fs.writeJson(packageJsonPath, pkg, { spaces: 2 });
}

/**
 * Print a summary of all commands available for the created app.
 */
function printCommandSummary(destDir, appPackageJsonPath) {
  const pkg = fs.readJsonSync(appPackageJsonPath, { throws: false }) || {};
  const meteorConfig = pkg.meteor || {};
  const hasTestModule = !!meteorConfig.testModule;
  const hasClient = !!(meteorConfig.mainModule && meteorConfig.mainModule.client);
  const m = METEOR_EXECUTABLE;
  const scripts = pkg.scripts || {};

  // Longest invocation string, for alignment
  const names = Object.keys(scripts);
  const maxLen = names.reduce((max, n) => {
    const inv = n === 'start' ? 'npm start' : `npm run ${n}`;
    return Math.max(max, inv.length);
  }, 0);

  console.log('');
  console.log('─────────────────────────────────────────────────────');
  console.log(`  App ready at: ${destDir}`);
  console.log('─────────────────────────────────────────────────────');
  console.log('');
  console.log(`  cd ${destDir}`);
  console.log('');
  console.log('  Run commands (meteor checkout binary):');
  console.log(`    ${m} run`);
  console.log(`    ${m} run --production`);

  if (hasTestModule) {
    console.log(`    ${m} test --driver-package meteortesting:mocha`);
    console.log(`    ${m} test --once --driver-package meteortesting:mocha`);
    if (hasClient) {
      console.log(`    ${m} test --full-app --driver-package meteortesting:mocha`);
      console.log(`    ${m} test --full-app --once --driver-package meteortesting:mocha`);
    }
  }

  console.log(`    ${m} build ./_build --directory`);
  console.log('');
  console.log('  npm scripts (run from the app directory):');

  for (const [name, cmd] of Object.entries(scripts)) {
    const invocation = name === 'start' ? 'npm start' : `npm run ${name}`;
    const padding = ' '.repeat(maxLen - invocation.length);
    console.log(`    ${invocation}${padding}  # ${cmd}`);
  }

  console.log('─────────────────────────────────────────────────────');
  console.log('');
}

async function setupFromApp(appName, destDir, { isMonorepo = false, force = false } = {}) {
  const sourceDir = path.join(APPS_DIR, appName);

  if (!fs.existsSync(sourceDir)) {
    const available = fs.readdirSync(APPS_DIR).join(', ');
    throw new Error(
      `App '${appName}' not found in tools/modern-tests/apps/\nAvailable apps: ${available}`
    );
  }

  if (fs.existsSync(destDir)) {
    if (force) {
      console.log(`Removing existing destination: ${destDir}...`);
      await fs.remove(destDir);
    } else {
      console.error(`Error: destination already exists: ${destDir}`);
      console.error('Remove it first or use --force to replace it.');
      process.exit(1);
    }
  }

  await fs.ensureDir(path.dirname(destDir));

  console.log(`Copying app '${appName}' to ${destDir}...`);
  await fs.copy(sourceDir, destDir, {
    dereference: true,
    preserveTimestamps: true,
    overwrite: true,
  });
  console.log('Copy complete.');

  const appPackageJsonPath = isMonorepo
    ? path.join(destDir, 'app', 'package.json')
    : path.join(destDir, 'package.json');

  const envVars = extractEnvVarsFromTestFile(appName, true);

  if (fs.existsSync(appPackageJsonPath)) {
    console.log('Injecting npm scripts into package.json...');
    if (Object.keys(envVars).length > 0) {
      console.log('  env from test file:', Object.entries(envVars).map(([k, v]) => `${k}=${v}`).join(' '));
    }
    await injectNpmScripts(appPackageJsonPath, envVars);
  }

  const meteorAppDir = isMonorepo ? path.join(destDir, 'app') : destDir;

  console.log('Adding rspack package...');
  await execa(METEOR_EXECUTABLE, ['add', 'rspack'], {
    cwd: meteorAppDir,
    stdio: 'inherit',
  });

  if (isMonorepo) {
    console.log('Running npm install at root level...');
    await execa.command('npm install', { cwd: destDir, stdio: 'inherit', shell: true });
    console.log('Running npm install at app level...');
    await execa.command('npm install', {
      cwd: path.join(destDir, 'app'),
      stdio: 'inherit',
      shell: true,
    });
  } else {
    console.log('Running npm install...');
    await execa.command('npm install', { cwd: destDir, stdio: 'inherit', shell: true });
  }

  return { destDir, appPackageJsonPath };
}

async function setupFromSkeleton(skeletonName, destDir, { force = false } = {}) {
  if (fs.existsSync(destDir)) {
    if (force) {
      console.log(`Removing existing destination: ${destDir}...`);
      await fs.remove(destDir);
    } else {
      console.error(`Error: destination already exists: ${destDir}`);
      console.error('Remove it first or use --force to replace it.');
      process.exit(1);
    }
  }

  const parentDir = path.dirname(destDir);
  const appDirName = path.basename(destDir);

  await fs.ensureDir(parentDir);

  console.log(`Creating Meteor app '${appDirName}' via "meteor create --${skeletonName}"...`);
  await execa(METEOR_EXECUTABLE, ['create', `--${skeletonName}`, appDirName], {
    cwd: parentDir,
    stdio: 'inherit',
  });

  console.log('Adding rspack package...');
  await execa(METEOR_EXECUTABLE, ['add', 'rspack'], {
    cwd: destDir,
    stdio: 'inherit',
  });

  const appPackageJsonPath = path.join(destDir, 'package.json');

  const envVars = extractEnvVarsFromTestFile(skeletonName, false);

  if (fs.existsSync(appPackageJsonPath)) {
    console.log('Injecting npm scripts into package.json...');
    if (Object.keys(envVars).length > 0) {
      console.log('  env from test file:', Object.entries(envVars).map(([k, v]) => `${k}=${v}`).join(' '));
    }
    await injectNpmScripts(appPackageJsonPath, envVars);
  }

  return { destDir, appPackageJsonPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.app && !args.skeleton) {
    console.error('Error: you must provide --app <name> or --skeleton <name>');
    printHelp();
    process.exit(1);
  }

  if (args.app && args.skeleton) {
    console.error('Error: --app and --skeleton are mutually exclusive');
    process.exit(1);
  }

  const sourceName = args.app || args.skeleton;

  // --output is the full destination path; if omitted, default to ./dist/<sourceName>
  const destDir = args.output
    ? path.resolve(REPO_ROOT, args.output)
    : path.join(DEFAULT_OUTPUT_DIR, sourceName);

  let result;
  if (args.app) {
    result = await setupFromApp(args.app, destDir, { isMonorepo: args.monorepo, force: args.force });
  } else {
    result = await setupFromSkeleton(args.skeleton, destDir, { force: args.force });
  }

  printCommandSummary(result.destDir, result.appPackageJsonPath);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
