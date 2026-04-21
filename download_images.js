const fs = require('fs');
const path = require('path');
const https = require('https');

const images = {
  // Backgrounds
  "Gemini-Generated-Image-2c1w2j2c1w2j2c1w.png": "https://i.postimg.cc/yd1qPBQZ/Gemini-Generated-Image-2c1w2j2c1w2j2c1w.png",
  "1000x200.png": "https://i.postimg.cc/4dm7tdc0/1000x200.png",
  "El-cielo-llega-a-nuestra-escuela.png": "https://i.postimg.cc/L6g2DV4v/El-cielo-llega-a-nuestra-escuela.png",

  // Sponsors
  "Logo-Madobox.png": "https://i.postimg.cc/DwmMPT99/Logo-Madobox.png",
  "Logo-La-Bonanza-Avocados-pdf.png": "https://i.postimg.cc/8zs0mS29/Logo-La-Bonanza-Avocados-pdf.png",
  "Logo-Global-Frut-png.png": "https://i.postimg.cc/0yrB0sTX/Logo-Global-Frut-png.png",
  "Diseno-sin-tituloww.png": "https://i.postimg.cc/kXjJfW4x/Diseno-sin-tituloww.png",
  "51d89e34-3d94-448c-9b34-16abb3360127.png": "https://i.postimg.cc/QtpNbP97/51d89e34-3d94-448c-9b34-16abb3360127.png",
  "logo-Strong-plastic-pdf.png": "https://i.postimg.cc/Gm95xCWf/logo-Strong-plastic-pdf.png",
  "logo-RV-Fresh.png": "https://i.postimg.cc/rwzPNT6X/logo-RV-Fresh.png",

  // Entities
  "logo-parque.png": "https://i.postimg.cc/25nfRWzG/logo-parque.png",
  "logo-secretaria-cultura-y-turismo.png": "https://i.postimg.cc/Pq1ksDtQ/logo-secretaria-cultura-y-turismo.png",
  "logo-huatapera.png": "https://i.postimg.cc/vm5dFnQ3/logo-huatapera.png",
  "logo-ccfdsp.png": "https://i.postimg.cc/xdLSDm0y/logo-ccfdsp.png",
};

const targetDir = path.join(__dirname, 'public', 'flyers');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function download(filename, url) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(path.join(targetDir, filename));
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(path.join(targetDir, filename));
      reject(err);
    });
  });
}

async function run() {
  for (const [filename, url] of Object.entries(images)) {
    console.log(`Downloading ${filename}...`);
    try {
      await download(filename, url);
      console.log(`Successfully downloaded ${filename}`);
    } catch (e) {
      console.error(`Failed to download ${filename}:`, e);
    }
  }
}

run();
