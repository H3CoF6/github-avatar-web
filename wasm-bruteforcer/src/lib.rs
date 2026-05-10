use wasm_bindgen::prelude::*;
use md5;

#[wasm_bindgen]
pub fn find_matches(
    target_pattern: u32,
    start_id: u32,
    end_id: u32,
) -> Vec<u32> {
    let mut matches = Vec::new();
    
    // Pre-allocate a buffer for integer to string conversion
    // Max u32 is 4294967295 (10 digits)
    let mut buf = [0u8; 11];
    
    for id in start_id..=end_id {
        // Fast integer to string without allocation
        let len = write_u32(&mut buf, id);
        let id_bytes = &buf[..len];
        
        // Use the simplest compute API to avoid any state issues
        let result = md5::compute(id_bytes);
        
        let mut pattern: u32 = 0;
        for i in 0..15 {
            let byte_idx = i / 2;
            let byte = result[byte_idx];
            let nibble = if i % 2 == 0 {
                (byte >> 4) & 0x0f // HI
            } else {
                byte & 0x0f // LO
            };
            
            if nibble % 2 == 0 {
                pattern |= 1 << i;
            }
        }
        
        if pattern == target_pattern {
            matches.push(id);
        }
    }
    
    matches
}

// Helper to convert u32 to bytes without std::fmt or String
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
