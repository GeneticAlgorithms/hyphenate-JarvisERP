import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function screenshotPresentMode() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const artifactsDir = join(__dirname, '..', 'artifacts', 'present-mode');
  await mkdir(artifactsDir, { recursive: true });

  console.log('\nCapturing present mode slides at 1920x1080...\n');
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  // Load the site with present mode auto-open (no autoplay)
  const distPath = join(__dirname, 'dist', 'index.html');
  await page.goto(`file://${distPath}?present=1&autoplay=0`, { waitUntil: 'networkidle' });

  // Wait for present mode to open
  await page.waitForTimeout(1000);

  // Get the number of slides
  const slideCountText = await page.textContent('.slide-counter');
  const totalSlides = parseInt(slideCountText.split('/')[1].trim());

  console.log(`Found ${totalSlides} slides\n`);

  // Capture each slide
  for (let i = 0; i < totalSlides; i++) {
    const slideNum = i + 1;
    
    // Wait for slide to render
    await page.waitForTimeout(800);
    
    const filename = `slide_${String(slideNum).padStart(2, '0')}_1920x1080.png`;
    const filepath = join(artifactsDir, filename);
    
    await page.screenshot({
      path: filepath,
      type: 'png',
      fullPage: false,
    });
    
    console.log(`✓ ${filename}`);
    
    // Navigate to next slide (if not last)
    if (i < totalSlides - 1) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(500);
    }
  }

  await context.close();
  await browser.close();
  console.log(`\n✅ All present mode slides saved to: ${artifactsDir}\n`);
}

screenshotPresentMode().catch(console.error);
