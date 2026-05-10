// Test MD5 calculation to match Rust behavior
const crypto = require('crypto');

function testId(id) {
    const idStr = id.toString();
    const hash = crypto.createHash('md5').update(idStr).digest('hex');
    console.log(`ID: ${id}, String: "${idStr}", MD5: ${hash}`);
    
    const bytes = [];
    for (let i = 0; i < 16; i++) {
        bytes.push(parseInt(hash.slice(i * 2, i * 2 + 2), 16));
    }
    
    let pattern = 0;
    for (let i = 0; i < 15; i++) {
        const byteIdx = Math.floor(i / 2);
        const byte = bytes[byteIdx];
        const nibble = i % 2 === 0 ? (byte >> 4) & 0x0f : byte & 0x0f;
        if (nibble % 2 === 0) pattern |= (1 << i);
    }
    
    console.log(`Pattern: ${pattern} (binary: ${pattern.toString(2).padStart(15, '0')})`);
    console.log('---');
}

testId(1);
testId(123);
testId(1000);
