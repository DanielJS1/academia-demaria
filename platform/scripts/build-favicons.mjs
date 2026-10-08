import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

for (const site of ["academia", "homologacao", "conhecimento"]) {
  const dir = `${publicDir}/icons/${site}`;
  await mkdir(dir, { recursive: true });
  const mark = await sharp(`${publicDir}/brand/${site}.png`)
    .trim({ background: transparent, threshold: 10 })
    .resize(432, 432, { fit: "contain", background: transparent })
    .extend({ top: 40, bottom: 40, left: 40, right: 40, background: transparent })
    .png().toBuffer();
  for (const size of [32, 48, 180, 192, 512]) {
    const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
    await sharp(mark).resize(size, size).png().toFile(`${dir}/${name}`);
  }
  // ICO supports PNG entries; include native sizes for tabs and bookmark bars.
  const sizes = [16, 32, 48];
  const images = await Promise.all(sizes.map(size => sharp(mark).resize(size, size).png().toBuffer()));
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  images.forEach((png, i) => {
    const entry = 6 + i * 16;
    header[entry] = sizes[i];
    header[entry + 1] = sizes[i];
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  await writeFile(`${dir}/favicon.ico`, Buffer.concat([header, ...images]));
  console.log(`${site}: PNG 32/48/180/192/512 e ICO 16/32/48`);
}
