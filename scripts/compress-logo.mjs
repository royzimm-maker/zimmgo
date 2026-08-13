import sharp from "sharp";
import { statSync } from "fs";

const jobs = [
  { in: "public/logo-full.png", out: "public/logo-full.png", maxWidth: 900 },
  { in: "public/logo-mark.png", out: "public/logo-mark.png", maxWidth: 512 },
  { in: "app/icon.png", out: "app/icon.png", maxWidth: 512 },
];

for (const job of jobs) {
  const before = statSync(job.in).size;
  const buf = await sharp(job.in)
    .resize({ width: job.maxWidth, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toBuffer();
  await sharp(buf).toFile(job.out + ".tmp");
  const after = statSync(job.out + ".tmp").size;
  console.log(`${job.in}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB`);
}
