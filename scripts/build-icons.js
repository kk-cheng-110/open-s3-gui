const png2icons = require('png2icons');
const fs = require('fs');
const path = require('path');

const input = fs.readFileSync(path.join(__dirname, '../build/icon.png'));

try {
    // 生成 macOS icns 文件
    const icns = png2icons.createICNS(input, png2icons.BILINEAR, 0);
    fs.writeFileSync(path.join(__dirname, '../build/icon.icns'), icns);
    console.log('✅ icon.icns 生成成功');
} catch (err) {
    console.error('❌ 生成 icns 失败:', err);
}

try {
    // 生成 Windows ico 文件
    const ico = png2icons.createICO(input, png2icons.BILINEAR, 0, false);
    fs.writeFileSync(path.join(__dirname, '../build/icon.ico'), ico);
    console.log('✅ icon.ico 生成成功');
} catch (err) {
    console.error('❌ 生成 ico 失败:', err);
}
