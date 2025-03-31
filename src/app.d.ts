/// <reference types="@sveltejs/kit" />

// Declaration for the 'utif' npm module (assuming default export)
declare module 'utif' {
  interface UTIF {
    decode(buffer: ArrayBuffer | Uint8Array): any[];
    decodeImage(buffer: ArrayBuffer | Uint8Array, ifd: any): void;
    toRGBA8(ifd: any): Uint8Array; // Usually returns Uint8Array
    // Add other functions if needed based on library usage
  }
  const UTIF: UTIF;
  export default UTIF;
}

// Keep PapaParse types if still needed elsewhere, otherwise remove
// declare module 'papaparse'; // Assuming types are installed via @types/papaparse
