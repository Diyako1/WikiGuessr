const fs = require('fs');
const path = require('path');

const images = [
  { name: 'setup.png', alt: 'New Game Setup' },
  { name: 'gameplay.png', alt: 'Gameplay' },
  { name: 'hint.png', alt: 'Optimal Path Hint' }
];

const screenshotsDir = path.join(__dirname, 'screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

console.log('Looking for images in screenshots/ folder...\n');

images.forEach(img => {
  const imagePath = path.join(screenshotsDir, img.name);
  
  if (fs.existsSync(imagePath)) {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString('base64');
    const ext = path.extname(img.name).slice(1);
    const mimeType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/webp';
    const dataUri = `data:${mimeType};base64,${base64}`;
    
    console.log(`<!-- ${img.alt} -->`);
    console.log(`<img src="${dataUri}" alt="${img.alt}" width="800" />\n`);
  } else {
    console.log(`⚠️  ${img.name} not found in screenshots/ folder\n`);
  }
});

console.log('\nCopy the HTML img tags above and paste them into your README.md');
