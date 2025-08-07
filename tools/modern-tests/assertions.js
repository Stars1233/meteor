/**
 * This file contains assertion helpers for testing Meteor applications.
 */

/**
 * Helper function to assert that a Meteor React app is running correctly
 * @param {number} port - Port where the app is running
 * @returns {Promise<void>}
 */
export async function assertMeteorReactApp(port) {
  // Navigate to the app
  await page.goto(`http://localhost:${port}`);

  // Check the title
  const title = await page.title();
  expect(title).toMatch(/react/);

  // Check for static content
  const h1Text = await page.$eval('h1', el => el.textContent);
  expect(h1Text).toMatch(/Welcome to Meteor!/);
}

/**
 * Helper function to assert that a Meteor app is using Rspack
 * @param {number} port - Port where the app is running
 * @returns {Promise<void>}
 */
export async function assertRspackScriptTag(port, shoudlExist = true) {
  // Navigate to the app
  await page.goto(`http://localhost:${port}`);

  // Get all script tags
  const scriptTags = await page.$$eval('script', scripts => 
    scripts.map(script => script.getAttribute('src'))
  );

  // Check if any script tag has __rspack__ in its path
  const hasRspackScript = scriptTags.some(src => src && src.includes('__rspack__'));
  expect(hasRspackScript).toBe(shoudlExist);
}
