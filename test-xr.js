import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({
    args: [
      '--enable-blink-features=WebXRTestAPI,MojoJS',
    ]
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('about:blank');
  
  const xrInfo = await page.evaluate(() => {
    return {
      xr: !!navigator.xr,
      xrTest: !!(navigator.xr && navigator.xr.test)
    };
  });
  
  console.log('XR Info:', xrInfo);
  
  await browser.close();
})();
