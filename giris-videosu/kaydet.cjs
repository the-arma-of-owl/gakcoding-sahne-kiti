// Sahneyi kare kare çizip MP4'e çevirir: node kaydet.cjs [fps] [cikti.mp4]
const puppeteer = require('puppeteer') // npm i puppeteer;
const { spawn } = require('child_process');
const path = require('path');

const FPS = +(process.argv[2] || 60);
const CIKTI = process.argv[3] || path.join(__dirname, 'giris.mp4');

(async () => {
  const tarayici = await puppeteer.launch({ executablePath: '/usr/bin/chromium', args: ['--allow-file-access-from-files'] });
  const sayfa = await tarayici.newPage();
  await sayfa.setViewport({ width: 1920, height: 1080 });
  await sayfa.goto('file://' + path.join(__dirname, 'index.html') + '?kayit');
  await sayfa.evaluate(() => document.fonts.ready);
  const sure = await sayfa.evaluate(() => { ciz(0); return 6; });
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', CIKTI], { stdio: ['pipe', 'inherit', 'inherit'] });
  const kare = Math.round(sure * FPS);
  for (let i = 0; i < kare; i++) {
    const url = await sayfa.evaluate((t) => { ciz(t); return document.getElementById('c').toDataURL('image/jpeg', 0.95); }, i / FPS);
    ff.stdin.write(Buffer.from(url.split(',')[1], 'base64'));
    if (i % 60 === 0) process.stdout.write(`${i}/${kare}\r`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await tarayici.close();
  console.log('bitti:', CIKTI);
})();
