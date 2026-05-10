use md5;

fn write_u32(buf: &mut [u8; 11], mut n: u32) -> usize {
    if n == 0 {
        buf[0] = b'0';
        return 1;
    }
    let mut i = 0;
    let mut temp_buf = [0u8; 10];
    let mut j = 0;
    while n > 0 {
        temp_buf[j] = b'0' + (n % 10) as u8;
        n /= 10;
        j += 1;
    }
    while j > 0 {
        j -= 1;
        buf[i] = temp_buf[j];
        i += 1;
    }
    i
}

fn main() {
    let id = 1u32;
    let mut buf = [0u8; 11];
    let len = write_u32(&mut buf, id);
    let id_bytes = &buf[..len];
    
    println!("ID: {}", id);
    println!("ID bytes: {:?}", id_bytes);
    println!("ID string: {}", std::str::from_utf8(id_bytes).unwrap());
    
    let result = md5::compute(id_bytes);
    println!("MD5: {:x}", result);
    
    let mut pattern: u32 = 0;
    for i in 0..15 {
        let byte_idx = i / 2;
        let byte = result[byte_idx];
        let nibble = if i % 2 == 0 {
            (byte >> 4) & 0x0f
        } else {
            byte & 0x0f
        };
        
        println!("i={}, byte_idx={}, byte=0x{:02x}, nibble=0x{:x} ({})", 
                 i, byte_idx, byte, nibble, if nibble % 2 == 0 { "even" } else { "odd" });
        
        if nibble % 2 == 0 {
            pattern |= 1 << i;
        }
    }
    
    println!("Pattern: {} (binary: {:015b}, hex: 0x{:x})", pattern, pattern, pattern);
}
