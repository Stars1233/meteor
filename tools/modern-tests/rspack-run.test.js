import { killProcessByPort, setupMeteorApp, runMeteorApp, cleanupTempDir, killMeteorProcess } from './helpers';

describe('rspack build and serve', () => {
  let meteorProcess;
  let tempDir;
  const PORT = 3100;

  beforeAll(async () => {
    // Setup the Meteor app
    tempDir = (await setupMeteorApp('react'))?.tempDir;

    // Run the Meteor app
    meteorProcess = (await runMeteorApp(tempDir, PORT))?.meteorProcess;
  });

  afterAll(async () => {
    // Kill the meteor process
    await killMeteorProcess(meteorProcess);

    // Ensure any process on the port is killed
    await killProcessByPort(PORT);

    // Clean up the temporary directory
    await cleanupTempDir(tempDir);
  });

  test('loads and has correct content', async () => {
    // Navigate to the app
    await page.goto(`http://localhost:${PORT}`);

    // Check the title
    const title = await page.title();
    expect(title).toMatch(/Meteor React/);

    // // Check for static content
    const h1Text = await page.$eval('h1', el => el.textContent);
    expect(h1Text).toMatch(/Welcome to Meteor!/);
  });
});
