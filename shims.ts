import './get-random-values-shim';
import '@ethersproject/shims';
import { TextDecoder, TextEncoder } from 'text-encoding';
import 'react-native-url-polyfill/auto';

if (typeof global.TextEncoder === 'undefined') {
  // @ts-ignore
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  // @ts-ignore
  global.TextDecoder = TextDecoder;
}
