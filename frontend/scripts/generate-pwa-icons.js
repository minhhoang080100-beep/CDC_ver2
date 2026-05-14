/**
 * generate-pwa-icons.js
 *
 * Generates PWA icons from the source logo using Node.js Canvas.
 * Falls back to simple file copy if canvas is unavailable.
 *
 * Usage:  node scripts/generate-pwa-icons.js
 */

const fs = require('fs');
const path = require('path');

const SOURCE_IMAGE = path.resolve(__dirname, '../assets/images/icon.png');
const OUTPUT_DIR = path.resolve(__dirname, '../public/icons');

const SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512];

async function generateIcons() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Check if source exists
  if (!fs.existsSync(SOURCE_IMAGE)) {
    console.error('❌ Source image not found:', SOURCE_IMAGE);
    process.exit(1);
  }

  // Try using sharp first (best quality)
  try {
    const sharp = require('sharp');
    console.log('Using sharp for icon generation...');

    for (const size of SIZES) {
      const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);
      
      await sharp(SOURCE_IMAGE)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .png()
        .toFile(outputPath);

      console.log(`  ✅ ${size}x${size} → ${path.basename(outputPath)}`);
    }

    console.log('\n🎉 All PWA icons generated successfully!');
    return;
  } catch (e) {
    console.log('sharp not available, trying canvas...');
  }

  // Fallback: just copy the source to all sizes (they will work but won't be resized)
  console.log('⚠️  No image processing library available.');
  console.log('   Copying source logo to all icon sizes (original resolution).');
  console.log('   For best results, install sharp: npm install --save-dev sharp\n');

  const sourceBuffer = fs.readFileSync(SOURCE_IMAGE);
  
  for (const size of SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);
    fs.writeFileSync(outputPath, sourceBuffer);
    console.log(`  📋 Copied → icon-${size}x${size}.png`);
  }

  console.log('\n✅ Icons copied (not resized). Consider resizing manually or installing sharp.');
}

generateIcons().catch(console.error);
