const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  path.join(__dirname, 'src', 'components', 'flyers', 'CircularDigital.js'),
  path.join(__dirname, 'src', 'components', 'flyers', 'FlyerPadres.js'),
  path.join(__dirname, 'src', 'components', 'flyers', 'FlyerNinos.js'),
];

const regex = /crossOrigin="anonymous"/g;

for (const file of filesToUpdate) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    const newContent = content.replace(regex, '');
    if (content !== newContent) {
      fs.writeFileSync(file, newContent, 'utf8');
      console.log(`Removed crossOrigin from ${path.basename(file)}`);
    } else {
      console.log(`No crossOrigin found in ${path.basename(file)}`);
    }
  } else {
    console.warn(`File not found: ${file}`);
  }
}
