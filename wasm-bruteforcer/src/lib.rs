use wasm_bindgen::prelude::*;
use md5::{Md5, Digest};

#[wasm_bindgen]
pub fn find_matches(
    target_pattern: u32, // 15 bits
    target_h: u32,       // 12 bits
    target_s: u32,       // 8 bits
    target_l: u32,       // 8 bits
    start_id: u32,
    end_id: u32,
) -> Vec<u32> {
    let mut matches = Vec::new();
    let mut hasher = Md5::new();
    
    for id in start_id..=end_id {
        let id_str = id.to_string();
        hasher.update(id_str.as_bytes());
        let result = hasher.finalize_reset();
        
        // 1. Check pattern (first 15 nibbles)
        // Each nibble % 2 == 0 is 'on'
        let mut pattern: u32 = 0;
        for i in 0..8 {
            let byte = result[i];
            
            // High nibble
            let hi = (byte >> 4) & 0x0f;
            if hi % 2 == 0 {
                pattern |= 1 << (i * 2);
            }
            
            if i * 2 + 1 < 15 {
                // Low nibble
                let lo = byte & 0x0f;
                if lo % 2 == 0 {
                    pattern |= 1 << (i * 2 + 1);
                }
            }
        }
        
        if pattern != target_pattern {
            continue;
        }
        
        // 2. Check color (bytes 12, 13, 14, 15)
        let h1 = (result[12] as u16 & 0x0f) << 8;
        let h2 = result[13] as u16;
        let h = (h1 | h2) as u32;
        let s = result[14] as u32;
        let l = result[15] as u32;
        
        if h == target_h && s == target_s && l == target_l {
            matches.push(id);
        }
    }
    
    matches
}
