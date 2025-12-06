// Web-specific shims - Web browsers already have these APIs built-in
// No need to polyfill crypto or text encoding on web

console.log('Shims Injected: Web environment detected, using native browser APIs');

// Just ensure TextEncoder/TextDecoder are available (they should be in modern browsers)
if (typeof globalThis.TextEncoder === 'undefined') {
  console.warn('TextEncoder not available in this browser');
}

if (typeof globalThis.TextDecoder === 'undefined') {
  console.warn('TextDecoder not available in this browser');
}
