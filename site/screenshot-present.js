import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir } from 'fs/promises';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { extname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple HTTP server for serving the dist folder
function startServer(distPath, port = 8765) {
  return new Promise((resolve) => {
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };

    const server = createServer((req, res) => {
      let filePath = join(distPath, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
      
      if (existsSync(filePath) && !filePath.endsWith('/')) {
        const ext = extname(filePath);
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        
        try {
          const content = readFileSync(filePath);
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content);
        } catch (error) {
          res.writeHead(500);
          res.end('Error loading file');
        }
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(port, () => {
      console.log(`Server started on http://localhost:${port}`);
      resolve(server);
    });
  });
}

async function screenshotPresentMode() {
  const distPath = join(__dirname, 'dist');
  const port = 8765;
  
  // Start HTTP server
  const server = await startServer(distPath, port);

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
  await page.goto(`http://localhost:${port}/?present=1&autoplay=0`, { waitUntil: 'networkidle' });

  // Wait longer for present mode to open and JS to initialize
  await page.waitForTimeout(2500);

  // Check if present mode is actually open
  const presentModeVisible = await page.evaluate(() => {
    const presentMode = document.getElementById('presentMode');
    return presentMode && !presentMode.classList.contains('hidden');
  });

  if (!presentModeVisible) {
    console.error('❌ Present mode did not open! Check if ?present=1 parameter is working.');
    await browser.close();
    server.close();
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
    
    // Wait for GSAP animation to complete (600ms duration + stagger + buffer)
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

  await context.close();
  await browser.close();
  server.close();
  console.log(`\n✅ All present mode slides saved to: ${artifactsDir}\n`);
}

screenshotPresentMode().catch(console.error);
