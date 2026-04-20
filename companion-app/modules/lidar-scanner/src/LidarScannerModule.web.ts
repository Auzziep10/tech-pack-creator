import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './LidarScanner.types';

type LidarScannerModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class LidarScannerModule extends NativeModule<LidarScannerModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(LidarScannerModule, 'LidarScannerModule');
