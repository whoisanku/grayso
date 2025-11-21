
export function hexToDataUrl(hex: string): string {
  // Check if it's already a data URL or invalid
  if (!hex || typeof hex !== 'string' || hex.startsWith('data:')) {
    return hex;
  }

  // Clean prefixes like "0x" or "\x"
  let cleanHex = hex;
  if (cleanHex.startsWith('0x')) {
    cleanHex = cleanHex.slice(2);
  } else if (cleanHex.startsWith('\\x')) {
    cleanHex = cleanHex.slice(2);
  } else if (cleanHex.startsWith('\\\\x')) {
     // Handle double backslash case if it comes through that way
    cleanHex = cleanHex.slice(3); // or more depending on parsing
  }

  // Basic validation for hex characters
  if (!/^[0-9A-Fa-f]+$/.test(cleanHex)) {
     // If it has non-hex chars, maybe it's not hex.
     // But wait, user said "profilePic": "\\x6461..."
     // If I strip \\x, I get 6461... which is hex.
     // If it fails regex, return original.
     // console.warn("String is not valid hex after cleaning:", cleanHex.substring(0, 10));
     return hex;
  }

  try {
    // Convert hex to string
    let str = '';
    for (let i = 0; i < cleanHex.length; i += 2) {
      const code = parseInt(cleanHex.substr(i, 2), 16);
      if (isNaN(code)) return hex;
      str += String.fromCharCode(code);
    }
    return str;
  } catch (e) {
    console.warn("Failed to decode hex image:", e);
    return hex;
  }
}
