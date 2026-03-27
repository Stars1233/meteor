/**
 * Custom Jest reporter that prints a structured summary of all test results,
 * including detailed error logs for failures.
 */
class SummaryReporter {
  constructor(globalConfig) {
    this._globalConfig = globalConfig;
  }

  onRunComplete(_contexts, results) {
    const passed = [];
    const failed = [];
    const skipped = [];

    for (const suite of results.testResults) {
      for (const test of suite.testResults) {
        const entry = {
          name: test.fullName || test.title,
          suite: suite.testFilePath.replace(this._globalConfig.rootDir + '/', ''),
          duration: test.duration,
          status: test.status,
        };

        if (test.status === 'passed') {
          passed.push(entry);
        } else if (test.status === 'failed') {
          entry.errors = test.failureMessages || [];
          failed.push(entry);
        } else {
          skipped.push(entry);
        }
      }
    }

    this._printConsole(passed, failed, skipped);
  }

  _printConsole(passed, failed, skipped) {
    const divider = '═'.repeat(70);
    const thinDivider = '─'.repeat(70);

    console.log('\n' + divider);
    console.log('  E2E TEST SUMMARY');
    console.log(divider);

    if (passed.length > 0) {
      console.log(`\n  PASSED (${passed.length}):`);
      console.log(thinDivider);
      for (const t of passed) {
        const duration = t.duration ? ` (${(t.duration / 1000).toFixed(1)}s)` : '';
        console.log(`    [PASS] ${t.name}${duration}`);
      }
    }

    if (skipped.length > 0) {
      console.log(`\n  SKIPPED (${skipped.length}):`);
      console.log(thinDivider);
      for (const t of skipped) {
        console.log(`    [SKIP] ${t.name}`);
      }
    }

    if (failed.length > 0) {
      console.log(`\n  FAILED (${failed.length}):`);
      console.log(thinDivider);
      for (const t of failed) {
        const duration = t.duration ? ` (${(t.duration / 1000).toFixed(1)}s)` : '';
        console.log(`\n    [FAIL] ${t.name}${duration}`);
        console.log(`           Suite: ${t.suite}`);
        for (const err of t.errors) {
          const indented = err
            .split('\n')
            .map(line => `           ${line}`)
            .join('\n');
          console.log(indented);
        }
      }
    }

    const totalTime = [...passed, ...failed, ...skipped]
      .reduce((sum, t) => sum + (t.duration || 0), 0);

    console.log('\n' + divider);
    console.log(
      `  TOTAL: ${passed.length + failed.length + skipped.length} | ` +
      `PASSED: ${passed.length} | ` +
      `FAILED: ${failed.length} | ` +
      `SKIPPED: ${skipped.length} | ` +
      `TIME: ${(totalTime / 1000).toFixed(1)}s`
    );
    console.log(divider + '\n');
  }
}

module.exports = SummaryReporter;
