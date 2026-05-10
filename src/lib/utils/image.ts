export interface IdenticonData {
  pattern: number; // 15-bit integer
  h: number;       // 0-4095
  s: number;       // 0-255
  l: number;       // 0-255
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return [h * 360, s * 100, l * 100];
}

export function findBestHslMatch(targetR: number, targetG: number, targetB: number): {h: number, s: number, l: number} {
  const [targetH, targetS, targetL] = rgbToHsl(targetR, targetG, targetB);
  
  // Reverse mapping:
  // hue = h * 360 / 4095
  // sat = 65.0 - (s * 20 / 255)
  // lum = 75.0 - (l * 20 / 255)
  
  const h = Math.round((targetH * 4095) / 360);
  const s = Math.round(((65.0 - targetS) * 255) / 20);
  const l = Math.round(((75.0 - targetL) * 255) / 20);
  
  return {
    h: Math.max(0, Math.min(4095, h)),
    s: Math.max(0, Math.min(255, s)),
    l: Math.max(0, Math.min(255, l))
  };
}
