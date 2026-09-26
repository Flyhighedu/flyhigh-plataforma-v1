const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { QRCodeSVG } = require('qrcode.react');

function qrDataURL(value) {
  const svg = renderToStaticMarkup(React.createElement(QRCodeSVG, {
    xmlns: 'http://www.w3.org/2000/svg', value, size: 272, level: 'M', marginSize: 4,
    bgColor: '#ffffff', fgColor: '#071a33',
  }));
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}
module.exports = { qrDataURL };
