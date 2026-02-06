---
name: testing
description: Use when writing tests, debugging test failures, running the test suite, or setting up test infrastructure. Covers self-test, package tests, and modern E2E tests.
---

# Testing

Test patterns, commands, and utilities for the Meteor codebase.

## Test Commands

```bash
# CLI self-tests
./meteor self-test                           # Run all CLI tests
./meteor self-test "test name"               # Run specific test

# Package tests
./meteor test-packages ./packages/my-pkg     # Test single package
./meteor test-packages ./packages/my-pkg --driver-package meteortesting:mocha

# Modern E2E tests (Jest + Playwright)
npm run install:modern                       # Install dependencies
npm run test:modern                          # Run all E2E tests
npm run test:modern -- -t="React"            # Run specific test
```

## Modern E2E Tests (`tools/modern-tests/`)

Jest + Playwright suite for verifying modern bundler integrations (rspack). Tests cover framework skeletons and build scenarios.

**Test apps:** `apps/{react,vue,svelte,solid,blaze,typescript,babel,coffeescript,monorepo}`

## Test Helpers Package (`packages/test-helpers`)

Comprehensive testing utilities for Meteor applications.

### Async Testing

```javascript
import { testAsyncMulti, simplePoll, waitUntil } from 'meteor/test-helpers';

// Wait for condition
await waitUntil(() => someCondition, { timeout: 5000, interval: 100 });

// Poll until ready
simplePoll(() => isReady(), successCallback, failCallback);
```

### DOM/UI Testing

```javascript
import { clickElement, simulateEvent, canonicalizeHtml, renderToDiv } from 'meteor/test-helpers';

clickElement(button);
simulateEvent(input, 'keydown', { keyCode: 13 });
const normalized = canonicalizeHtml(html);
```

### Connection Testing

```javascript
import { makeTestConnection, captureConnectionMessages } from 'meteor/test-helpers';

const conn = makeTestConnection(clientId);
const messages = captureConnectionMessages(server);
```

### Utilities

| Function | Description |
|----------|-------------|
| `SeededRandom` | Predictable random for deterministic tests |
| `try_all_permutations()` | Test all permutations of inputs |
| `withCallbackLogger()` | Track callback invocations |
| `mockBehaviours()` | Behavior mocking |

## Tinytest (`packages/tinytest`)

Meteor's built-in test framework.

```javascript
Tinytest.add('my test', function (test) {
  test.equal(1 + 1, 2);
  test.isTrue(true);
  test.throws(function () { throw new Error(); });
});

Tinytest.addAsync('async test', async function (test) {
  const result = await asyncOperation();
  test.equal(result, expected);
});
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TEST_METADATA` | Test configuration JSON |
| `METEOR_TEST_PACKAGES` | Packages to test |

## Debug Commands

```bash
# Verbose build output
METEOR_DEBUG_BUILD=1 meteor run

# Profile build performance
METEOR_PROFILE=1 meteor build

# Force rebuild
meteor reset && meteor run

# Run specific package tests with driver
meteor test-packages ./packages/my-package --driver-package meteortesting:mocha
```

## Writing Package Tests

In `package.js`:

```javascript
Package.onTest(function(api) {
  api.use(['tinytest', 'test-helpers', 'my-package']);
  api.addFiles('my-package-tests.js');
});
```

In `my-package-tests.js`:

```javascript
import { MyPackage } from 'meteor/my-package';

Tinytest.add('MyPackage - basic functionality', function (test) {
  const result = MyPackage.doSomething();
  test.equal(result, expected);
});
```
