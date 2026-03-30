#!/usr/bin/env node
//
// checkout-pr.js — prepare a local branch from a fork contribution
//
// Usage:
//   node scripts/checkout-pr.js <PR-URL>
//   node scripts/checkout-pr.js <user>:<branch>
//   node scripts/checkout-pr.js <fork-repo-url> <branch>
//
// Examples:
//   node scripts/checkout-pr.js https://github.com/meteor/meteor/pull/<PR-number>
//   node scripts/checkout-pr.js <user>:<branch>
//   node scripts/checkout-pr.js <fork-repo-url> <branch>

'use strict';

const { execSync } = require('child_process');
const https = require('https');

// Colors (disabled if stdout is not a TTY)
const isTTY = process.stdout.isTTY;
const c = {
  red:    isTTY ? '\x1b[0;31m' : '',
  green:  isTTY ? '\x1b[0;32m' : '',
  yellow: isTTY ? '\x1b[0;33m' : '',
  cyan:   isTTY ? '\x1b[0;36m' : '',
  bold:   isTTY ? '\x1b[1m' : '',
  reset:  isTTY ? '\x1b[0m' : '',
};

function info(msg)  { console.log(`${c.cyan}\u2192${c.reset} ${msg}`); }
function ok(msg)    { console.log(`${c.green}\u2713${c.reset} ${msg}`); }
function warn(msg)  { console.log(`${c.yellow}\u26A0${c.reset} ${msg}`); }
function err(msg)   { console.error(`${c.red}\u2717${c.reset} ${msg}`); }

function die(msg) {
  err(msg);
  process.exit(1);
}

function usage() {
  console.log(`Usage:
  checkout-pr.js <PR-URL>
  checkout-pr.js <user>:<branch>
  checkout-pr.js <fork-repo-url> <branch>

Prepares a local branch from a fork contribution for testing and review.

Examples:
  node scripts/checkout-pr.js https://github.com/meteor/meteor/pull/<PR-number>
  node scripts/checkout-pr.js <user>:<branch>
  node scripts/checkout-pr.js <fork-repo-url> <branch>`);
  process.exit(1);
}

function git(cmd, { silent = false } = {}) {
  try {
    return execSync(`git ${cmd}`, {
      encoding: 'utf8',
      stdio: silent ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'pipe', 'inherit'],
    }).trim();
  } catch (e) {
    if (silent) return null;
    throw e;
  }
}

function ghCli(args) {
  try {
    return execSync(`gh ${args}`, { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch {
    return null;
  }
}

function hasCommand(name) {
  try {
    execSync(process.platform === 'win32' ? `where ${name}` : `command -v ${name}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'meteor-checkout-pr' } }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function extractFromPrUrl(prUrl) {
  const match = prUrl.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  if (!match) die(`could not parse PR URL: ${prUrl}`);
  const [, repoPath, prNumber] = match;

  // Try gh CLI first
  if (hasCommand('gh')) {
    const result = ghCli(`pr view "${prUrl}" --json headRepositoryOwner,headRefName`);
    if (result) {
      try {
        const data = JSON.parse(result);
        const owner = data.headRepositoryOwner?.login;
        const branch = data.headRefName;
        if (owner && branch) return { owner, branch };
      } catch { /* fall through */ }
    }
  }

  // Fall back to GitHub REST API
  const apiUrl = `https://api.github.com/repos/${repoPath}/pulls/${prNumber}`;
  let body;
  try {
    body = await httpsGet(apiUrl);
  } catch (e) {
    die(`could not fetch PR data from ${apiUrl} (${e.message})`);
  }

  try {
    const data = JSON.parse(body);
    const owner = data.head?.user?.login;
    const branch = data.head?.ref;
    if (owner && branch) return { owner, branch };
  } catch { /* fall through */ }

  die(`could not extract fork owner/branch from PR #${prNumber}`);
}

function extractOwnerFromUrl(url) {
  const match = url.match(/github\.com[:/]([^/]+)\//);
  return match ? match[1] : null;
}

function normalizeUrl(url) {
  return url
    .replace(/\.git$/, '')
    .replace(/\/$/, '')
    .replace(/^https?:\/\//, '')
    .replace(/^git@github\.com:/, 'github.com/');
}

async function main() {
  const args = process.argv.slice(2);

  // Ensure we're inside a git repo
  if (!git('rev-parse --is-inside-work-tree', { silent: true })) {
    die('not inside a git repository');
  }

  let forkOwner, forkBranch, forkRepoUrl;

  if (args.length === 0) {
    usage();
  } else if (args.length === 1) {
    const arg = args[0];
    const prMatch = arg.match(/^https?:\/\/github\.com\/.*\/pull\/\d+/);
    const shortMatch = arg.match(/^([^:]+):(.+)$/);

    if (prMatch) {
      const result = await extractFromPrUrl(arg);
      forkOwner = result.owner;
      forkBranch = result.branch;
      forkRepoUrl = `https://github.com/${forkOwner}/meteor.git`;
    } else if (shortMatch) {
      forkOwner = shortMatch[1];
      forkBranch = shortMatch[2];
      forkRepoUrl = `https://github.com/${forkOwner}/meteor.git`;
    } else {
      err(`unrecognized format: ${arg}`);
      console.error('');
      usage();
    }
  } else if (args.length === 2) {
    forkRepoUrl = args[0];
    forkBranch = args[1];
    forkOwner = extractOwnerFromUrl(forkRepoUrl);
    if (!forkOwner) die(`could not extract owner from URL: ${forkRepoUrl}`);
  } else {
    usage();
  }

  const previousBranch = git('symbolic-ref --short HEAD', { silent: true })
    || git('rev-parse --short HEAD', { silent: true })
    || 'HEAD';

  // Detect if the PR is from the upstream repo (not a fork)
  let remoteName = '';
  let isUpstream = false;
  const originUrl = git('remote get-url origin', { silent: true });
  if (originUrl) {
    const normFork = normalizeUrl(forkRepoUrl);
    const normOrigin = normalizeUrl(originUrl);
    if (normFork === normOrigin) {
      remoteName = 'origin';
      isUpstream = true;
    }
  }

  let localBranch;
  if (isUpstream) {
    localBranch = forkBranch;
  } else {
    remoteName = forkOwner;
    localBranch = `fork/${forkOwner}/${forkBranch}`;
  }

  console.log(`${c.bold}--- checkout-pr ---${c.reset}`);
  info(`owner:        ${c.bold}${forkOwner}${c.reset}`);
  info(`branch:       ${c.bold}${forkBranch}${c.reset}`);
  info(`repo:         ${c.bold}${forkRepoUrl}${c.reset}`);
  if (isUpstream) {
    info(`upstream:     yes (using remote '${c.bold}${remoteName}${c.reset}')`);
  }
  info(`local branch: ${c.bold}${localBranch}${c.reset}`);
  console.log('');

  // Add remote if needed (skip for upstream PRs)
  if (!isUpstream) {
    const existingUrl = git(`remote get-url "${remoteName}"`, { silent: true });
    if (existingUrl) {
      warn(`remote '${remoteName}' already exists, reusing it`);
    } else {
      info(`adding remote '${remoteName}' \u2192 ${forkRepoUrl}`);
      git(`remote add "${remoteName}" "${forkRepoUrl}"`);
      ok(`remote '${remoteName}' added`);
    }
  }

  // Fetch the branch
  info(`fetching '${forkBranch}' from '${remoteName}'...`);
  const fetchResult = git(`fetch "${remoteName}" "${forkBranch}"`, { silent: true });
  if (fetchResult === null) {
    die(`failed to fetch branch '${forkBranch}' from '${remoteName}' \u2014 check that the fork and branch exist`);
  }
  ok(`fetched latest from '${remoteName}'`);

  // Create or switch to local branch
  const branchExists = git(`show-ref --verify "refs/heads/${localBranch}"`, { silent: true });
  if (branchExists) {
    warn(`branch '${localBranch}' already exists, switching and updating...`);
    git(`checkout "${localBranch}"`);
    git(`reset --hard "refs/remotes/${remoteName}/${forkBranch}"`);
  } else {
    info(`creating branch '${localBranch}'...`);
    git(`checkout -b "${localBranch}" "refs/remotes/${remoteName}/${forkBranch}"`);
  }

  console.log('');
  ok(`ready on branch: ${c.bold}${localBranch}${c.reset}`);
  info(`to switch back:  ${c.bold}git checkout ${previousBranch}${c.reset}`);
}

main().catch((e) => {
  die(e.message);
});
