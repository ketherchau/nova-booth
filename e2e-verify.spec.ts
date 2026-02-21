import { test, expect } from '@playwright/test';

test('verify filter application on live site', async ({ page }) => {
  // Go to the live site
  await page.goto('https://nova-booth.vercel.app/');
  
  // 1. Check if Pixels.js is loaded
  const isPixelsLoaded = await page.evaluate(() => typeof window.pixelsJS !== 'undefined');
  console.log('Pixels.js Loaded:', isPixelsLoaded);
  
  // 2. Select a hardware and style
  await page.click('button:has-text("SX-70")');
  await page.click('button:has-text("CYBERPUNK")');
  
  // 3. Jack In
  await page.click('button:has-text("JACK IN")');
  
  // 4. Capture Logs
  const logs: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    console.log('BROWSER LOG:', text);
  });
  
  // 5. Trigger sequence
  // Note: We might need to mock getUserMedia if the browser blocks it in headless mode
  // But let's see what the logs say first.
  const captureBtn = page.locator('button >> .w-10.h-10.rounded-full'); // Red button
  if (await captureBtn.isVisible()) {
    await captureBtn.click();
  } else {
     console.log('Capture button not found via class, trying text...');
     // The button in page.tsx doesn't have text inside, it's just a div.
  }
  
  await page.waitForTimeout(5000);
  console.log('Final Diagnostic Logs:', logs);
});
