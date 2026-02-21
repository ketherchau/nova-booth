import { test, expect } from '@playwright/test';

test('diagnostic: verify filter application logic', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // 1. Check if Pixels.js is loaded
  const isPixelsLoaded = await page.evaluate(() => typeof window.pixelsJS !== 'undefined');
  console.log('Pixels.js Loaded:', isPixelsLoaded);
  
  // 2. Select a hardware and style
  await page.click('button:has-text("SX-70")');
  await page.click('button:has-text("CYBERPUNK")');
  
  // 3. Jack In
  await page.click('button:has-text("JACK IN")');
  
  // 4. Trigger capture (we need to wait for the camera to start)
  await page.waitForTimeout(2000); 
  
  // 5. Mock the capture process or spy on putImageData if possible
  // Since we can't easily "see" the canvas content without visual diff, 
  // let's check the console logs we added.
  const logs: string[] = [];
  page.on('console', msg => logs.push(msg.text()));
  
  await page.click('button:has-text("Take Shot")'); // Adjust selector based on actual text/icon
  
  await page.waitForTimeout(1000);
  
  console.log('Console Logs:', logs);
  
  const hasFilterLog = logs.some(l => l.includes('Applying Pixels.js filter'));
  console.log('Filter Log Detected:', hasFilterLog);
});
