import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir } from 'fs/promises';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function screenshotPresentMode() {
  // Start Vite preview server
  console.log('Starting Vite preview server...\n');
  const viteProcess = spawn('npm', ['run', 'preview', '--', '--port', '4174'], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Wait for server to start
  await new Promise((resolve) => {
    viteProcess.stdout.on('data', (data) => {
      if (data.toString().includes('localhost')) {
        resolve();
      }
    });
    setTimeout(resolve, 3000); // Fallback timeout
  });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const artifactsDir = join(__dirname, '..', 'artifacts', 'present-mode');
  await mkdir(artifactsDir, { recursive: true });

  console.log('Capturing present mode slides at 1920x1080...\n');
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  try {
    // Load the site with present mode auto-open (no autoplay)
    await page.goto('http://localhost:4174/?present=1&autoplay=0', { waitUntil: 'networkidle', timeout: 10000 });

    // Wait for present mode to open
    await page.waitForTimeout(2000);

    // Check if present mode is open
    const presentModeVisible = await page.evaluate(() => {
      const presentMode = document.getElementById('presentMode');
      return presentMode && !presentMode.classList.contains('hidden');
    });

    if (!presentModeVisible) {
      console.error('❌ Present mode did not open!');
      await browser.close();
      viteProcess.kill();
      return;
    }

    console.log('✓ Present mode opened successfully\n');

    // Get the number of slides
    const slideCountText = await page.textContent('.slide-counter');
    const totalSlides = parseInt(slideCountText.split('/')[1].trim());

    console.log(`Found ${totalSlides} slides\n`);

    // Capture each slide
    for (let i = 0; i < totalSlides; i++) {
      const slideNum = i + 1;
      
      // Wait for GSAP animation to complete
      await page.waitForTimeout(1200);
      
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
        await page.waitForTimeout(600);
      }
    }

    console.log(`\n✅ All present mode slides saved to: ${artifactsDir}\n`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await context.close();
    await browser.close();
    viteProcess.kill();
  }
}

screenshotPresentMode().catch(console.error);
