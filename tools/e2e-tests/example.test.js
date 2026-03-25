import path from 'path';
import fs from 'fs';
import os from 'os';

import { runMeteorCommand, cleanupTempDir } from './helpers';

describe('Examples /', () => {
  it('meteor create --list returns available examples', async () => {
    const { processResult } = await runMeteorCommand(
      'create', ['--list'], os.tmpdir(),
      { captureOutput: true, checkExitCode: true }
    );
    // Should contain at least one example slug in the output
    expect(processResult.outputLines.join('\n')).toMatch(/Available examples/);
  });

  it('meteor create --example creates a Meteor app', async () => {
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const appName = `meteortest-example-${randomSuffix}`;
    const tempDir = path.join(os.tmpdir(), appName);

    try {
      await runMeteorCommand(
        'create', ['--example', 'tic-tac-toe', appName], os.tmpdir(),
        { checkExitCode: true }
      );

      // Verify the app was created with a .meteor directory
      expect(fs.existsSync(path.join(tempDir, '.meteor'))).toBe(true);
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});
