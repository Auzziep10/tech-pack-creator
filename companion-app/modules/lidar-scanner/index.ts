// Reexport the native module. On web, it will be resolved to LidarScannerModule.web.ts
// and on native platforms to LidarScannerModule.ts
export { default } from './src/LidarScannerModule';
export { default as LidarScannerView, previewModel } from './src/LidarScannerView';
export * from  './src/LidarScanner.types';
