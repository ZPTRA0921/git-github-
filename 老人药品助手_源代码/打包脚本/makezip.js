// 将 repack/ 目录打包为 unsigned.apk（STORE 不压缩模式，正斜杠路径，符合 APK 规范）
const fs = require('fs');
const path = require('path');

const ROOT = 'D:/zptra/Documents/Qoder/2026-11-08/fdea7729/老人药品助手_安装包/repack';
const OUT = 'D:/zptra/Documents/Qoder/2026-11-08/fdea7729/老人药品助手_安装包/unsigned.apk';

function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        crc ^= buf[i];
        for (let k = 0; k < 8; k++) {
            crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
        }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime(mtime) {
    const d = mtime ? new Date(mtime) : new Date();
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    return { date, time };
}

function collectFiles(dir, base) {
    const out = [];
    for (const name of fs.readdirSync(dir).sort()) {
        const full = path.join(dir, name);
        const rel = path.relative(base, full).split(path.sep).join('/');
        const st = fs.statSync(full);
        if (st.isDirectory()) {
            out.push(...collectFiles(full, base));
        } else {
            out.push({ name: rel, data: fs.readFileSync(full), mtime: st.mtimeMs });
        }
    }
    return out;
}

const files = collectFiles(ROOT, ROOT);
files.sort((a, b) => {
    if (a.name === 'AndroidManifest.xml') return -1;
    if (b.name === 'AndroidManifest.xml') return 1;
    return a.name < b.name ? -1 : 1;
});

const chunks = [];
const central = [];
let offset = 0;

for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const { date, time } = dosDateTime(f.mtime);
    const crc = crc32(f.data);
    const size = f.data.length;

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);       // version needed
    lh.writeUInt16LE(0, 6);        // flags
    lh.writeUInt16LE(0, 8);        // method: stored
    lh.writeUInt16LE(time, 10);
    lh.writeUInt16LE(date, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(size, 18);    // compressed size
    lh.writeUInt32LE(size, 22);    // uncompressed size
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);       // extra len

    chunks.push(lh, nameBuf, f.data);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);       // version made by
    ch.writeUInt16LE(20, 6);       // version needed
    ch.writeUInt16LE(0, 8);        // flags
    ch.writeUInt16LE(0, 10);       // method
    ch.writeUInt16LE(time, 12);
    ch.writeUInt16LE(date, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(size, 20);
    ch.writeUInt32LE(size, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt16LE(0, 30);       // extra
    ch.writeUInt16LE(0, 32);       // comment
    ch.writeUInt16LE(0, 34);       // disk
    ch.writeUInt16LE(0, 36);       // internal attrs
    ch.writeUInt32LE(0, 38);       // external attrs
    ch.writeUInt32LE(offset, 42);  // local header offset
    central.push(ch, nameBuf);

    offset += 30 + nameBuf.length + size;
}

const cdStart = offset;
const cd = Buffer.concat(central);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);
eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(files.length, 8);
eocd.writeUInt16LE(files.length, 10);
eocd.writeUInt32LE(cd.length, 12);
eocd.writeUInt32LE(cdStart, 16);
eocd.writeUInt16LE(0, 20);

fs.writeFileSync(OUT, Buffer.concat([...chunks, cd, eocd]));
console.log('entries:', files.length, 'bytes:', offset + cd.length + 22);
