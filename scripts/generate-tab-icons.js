const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const size = 48;
const outputDirectory = path.join(__dirname, '..', 'miniprogram', 'assets', 'tabs');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function createCanvas() {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => [0, 0, 0, 0]));
}

function setPixel(canvas, x, y, color) {
  if (x >= 0 && y >= 0 && x < size && y < size) canvas[y][x] = color;
}

function drawLine(canvas, fromX, fromY, toX, toY, color, width = 3) {
  const steps = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY));
  for (let step = 0; step <= steps; step += 1) {
    const x = Math.round(fromX + ((toX - fromX) * step) / steps);
    const y = Math.round(fromY + ((toY - fromY) * step) / steps);
    for (let offsetX = -Math.floor(width / 2); offsetX <= Math.floor(width / 2); offsetX += 1) {
      for (let offsetY = -Math.floor(width / 2); offsetY <= Math.floor(width / 2); offsetY += 1) setPixel(canvas, x + offsetX, y + offsetY, color);
    }
  }
}

function drawCircle(canvas, centerX, centerY, radius, color, filled = false) {
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      if ((filled && distance <= radius) || (!filled && distance >= radius - 2 && distance <= radius + 1)) setPixel(canvas, x, y, color);
    }
  }
}

function renderIcon(name, color) {
  const canvas = createCanvas();
  if (name === 'home') {
    drawLine(canvas, 10, 23, 24, 10, color, 4); drawLine(canvas, 24, 10, 38, 23, color, 4); drawLine(canvas, 13, 21, 13, 38, color, 4); drawLine(canvas, 35, 21, 35, 38, color, 4); drawLine(canvas, 13, 38, 35, 38, color, 4);
  } else if (name === 'records') {
    drawCircle(canvas, 24, 24, 15, color); drawLine(canvas, 24, 24, 24, 14, color, 3); drawLine(canvas, 24, 24, 32, 28, color, 3);
  } else if (name === 'growth') {
    drawLine(canvas, 10, 37, 10, 12, color, 3); drawLine(canvas, 10, 37, 39, 37, color, 3); drawLine(canvas, 13, 31, 22, 23, color, 4); drawLine(canvas, 22, 23, 29, 27, color, 4); drawLine(canvas, 29, 27, 38, 14, color, 4);
  } else {
    drawCircle(canvas, 24, 16, 8, color); drawCircle(canvas, 24, 38, 14, color); for (let y = 26; y < size; y += 1) for (let x = 8; x < 40; x += 1) if (y > 31 && Math.abs(x - 24) < 15) setPixel(canvas, x, y, color);
  }
  return canvas;
}

function writePng(filename, canvas) {
  const rows = [];
  for (const row of canvas) rows.push(Buffer.from([0, ...row.flat()]));
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
  fs.writeFileSync(path.join(outputDirectory, filename), png);
}

fs.mkdirSync(outputDirectory, { recursive: true });
for (const iconName of ['home', 'records', 'growth', 'profile']) {
  writePng(`${iconName}.png`, renderIcon(iconName, [155, 163, 158, 255]));
  writePng(`${iconName}-active.png`, renderIcon(iconName, [61, 136, 89, 255]));
}
