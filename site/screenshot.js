import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const screenshots = [
  { name: '01_hero', selector: '#hero', fullPage: false },
  { name: '02_moment', selector: '#moment', fullPage: false },
  { name: '03_three_systems', selector: '#systems', fullPage: false },
  { name: '04_architecture', selector: '#architecture', fullPage: false },
  { name: '05_trust_audit', selector: '#trust', fullPage: false },
  { name: '06_proof', selector: '#proof', fullPage: false },
  { name: '07_glossary', selector: '#glossary', fullPage: false },
];

const viewports = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1280x800', width: 1280, height: 800 },
];

async function takeScreenshots() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const artifactsDir = join(__dirname, '..', 'artifacts', 'screenshots');
  await mkdir(artifactsDir, { recursive: true });

  for (const viewport of viewports) {
    console.log(`\nTaking screenshots at ${viewport.name}...\n`);
    
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
    });

    const page = await context.newPage();

    // Load the site from dist
    const distPath = join(__dirname, 'dist', 'index.html');
    await page.goto(`file://${distPath}`, { waitUntil: 'networkidle' });

    // Wait for initial animations
    await page.waitForTimeout(2000);

    for (const screenshot of screenshots) {
      try {
        const element = await page.$(screenshot.selector);
        if (element) {
          // Scroll element into view
          await element.scrollIntoViewIfNeeded();
          await page.waitForTimeout(1000);

          // Force animations to complete by adding active classes and setting opacity
          await page.evaluate(() => {
            // Make all opacity:0 elements visible for screenshot
            document.querySelectorAll('[style*="opacity: 0"], [style*="opacity:0"]').forEach(el => {
              el.style.opacity = '1';
            });
            
            // Add active class to iso-layers
            document.querySelectorAll('.iso-layer').forEach(el => {
              el.classList.add('active');
              el.style.opacity = '1';
            });
            
            // Make stacked cards visible and revealed
            document.querySelectorAll('.stacked-card').forEach(el => {
              el.classList.add('revealed');
              el.style.opacity = '1';
            });
            
            // Make all animated elements visible
            document.querySelectorAll('.layer, .entry-card, .problem-card, .audit-block, .term-card').forEach(el => {
              el.style.opacity = '1';
              el.style.transform = 'none';
            });
          });
          
          await page.waitForTimeout(500);

          const filename = `${screenshot.name}_${viewport.name}.png`;
          const filepath = join(artifactsDir, filename);
          
          await element.screenshot({
            path: filepath,
            type: 'png',
          });
          
          console.log(`✓ ${filename}`);
        } else {
          console.log(`✗ ${screenshot.name} - element not found`);
        }
      } catch (error) {
        console.error(`Error capturing ${screenshot.name}:`, error.message);
      }
    }

    // Also take full page screenshot
    const fullPageFilename = `full_page_${viewport.name}.png`;
    const fullPagePath = join(artifactsDir, fullPageFilename);
    await page.screenshot({
      path: fullPagePath,
      fullPage: true,
      type: 'png',
    });
    console.log(`✓ ${fullPageFilename}`);

    await context.close();
  }

  await browser.close();
  console.log(`\n✅ All screenshots saved to: ${artifactsDir}\n`);
}

takeScreenshots().catch(console.error);
