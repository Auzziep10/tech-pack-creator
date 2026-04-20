import { NativeModule, requireNativeModule } from 'expo';

import { LidarScannerModuleEvents } from './LidarScanner.types';

declare class LidarScannerModule extends NativeModule<LidarScannerModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<LidarScannerModule>('LidarScanner');
