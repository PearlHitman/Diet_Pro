// Generates all PWA icons and iOS splash screen images from icon.svg.
// Run with: npm run generate-assets
//
// Requires the `sharp` package (installed as a devDep). The script writes
// to public/icons/ and public/splash/.

import sharp from 'sharp';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = dirname(dirname(__filename)); // project root

const SRC_SVG = join(root, 'public', 'icons', 'icon.svg');
const ICONS_DIR = join(root, 'public', 'icons');
const SPLASH_DIR = join(root, 'public', 'splash');

const BG = '#0a0a0f'; // matches T.bg darkest

// ─── PWA icons ───────────────────────────────────────────────

const ICONS = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 512, name: 'icon-512-maskable.png', padding: 64 }, // safe area for maskable
  { size: 180, name: 'apple-touch-icon.png' },
];

// ─── iOS splash screens ──────────────────────────────────────
// Sizes derived from current Apple device portrait dimensions.
// Each splash places the icon centered on the brand background.

const SPLASHES = [
  // iPhone 15 Pro Max / 14 Pro Max
  { w: 1290, h: 2796, name: 'iphone-15-pro-max.png' },
  // iPhone 15 Pro / 14 Pro
  { w: 1179, h: 2556, name: 'iphone-15-pro.png' },
  // iPhone 14 Plus / 13 Pro Max / 12 Pro Max
  { w: 1284, h: 2778, name: 'iphone-14-plus.png' },
  // iPhone 14 / 13 / 13 Pro / 12 / 12 Pro
  { w: 1170, h: 2532, name: 'iphone-14.png' },
  // iPhone 13 mini / 12 mini / 11 Pro / X / XS
  { w: 1125, h: 2436, name: 'iphone-13-mini.png' },
  // iPhone 11 Pro Max / XS Max
  { w: 1242, h: 2688, name: 'iphone-11-pro-max.png' },
  // iPhone 11 / XR
  { w: 828, h: 1792, name: 'iphone-11.png' },
  // iPhone 8 Plus / 7 Plus / 6S Plus
  { w: 1242, h: 2208, name: 'iphone-8-plus.png' },
  // iPhone 8 / 7 / 6S / SE 2nd gen
  { w: 750, h: 1334, name: 'iphone-8.png' },
  // iPhone SE 1st gen / 5
  { w: 640, h: 1136, name: 'iphone-se.png' },
];

// ─── Run ─────────────────────────────────────────────────────

async function main() {
  if (!existsSync(SRC_SVG)) {
    console.error(`Source SVG not found: ${SRC_SVG}`);
    process.exit(1);
  }
  if (!existsSync(SPLASH_DIR)) mkdirSync(SPLASH_DIR, { recursive: true });

  const svgBuf = readFileSync(SRC_SVG);

  // Icons
  for (const ic of ICONS) {
    const padding = ic.padding ?? 0;
    const inner = ic.size - padding * 2;
    const out = join(ICONS_DIR, ic.name);
    await sharp({
      create: { width: ic.size, height: ic.size, channels: 4, background: BG },
    })
      .composite([{
        input: await sharp(svgBuf).resize(inner, inner).png().toBuffer(),
        top: padding, left: padding,
      }])
      .png()
      .toFile(out);
    console.log(`✓ ${ic.name}`);
  }

  // Splashes — icon at ~25% of viewport width, centered.
  for (const sp of SPLASHES) {
    const iconSize = Math.floor(sp.w * 0.28);
    const iconBuf = await sharp(svgBuf).resize(iconSize, iconSize).png().toBuffer();
    const out = join(SPLASH_DIR, sp.name);
    await sharp({
      create: { width: sp.w, height: sp.h, channels: 4, background: BG },
    })
      .composite([{
        input: iconBuf,
        top: Math.floor((sp.h - iconSize) / 2),
        left: Math.floor((sp.w - iconSize) / 2),
      }])
      .png()
      .toFile(out);
    console.log(`✓ splash/${sp.name}`);
  }

  console.log('\nDone. Add the splash link tags from scripts/splash-meta.html to index.html.');
}

main().catch(e => { console.error(e); process.exit(1); });
