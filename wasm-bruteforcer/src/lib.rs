use wasm_bindgen::prelude::*;
use md5::{Md5, Digest};

#[wasm_bindgen]
pub fn find_matches(
    target_pattern: u32,
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
