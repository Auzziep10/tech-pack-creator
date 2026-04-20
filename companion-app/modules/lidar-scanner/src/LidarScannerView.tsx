import { requireNativeView } from 'expo';
import * as React from 'react';
import LidarScannerModule from './LidarScannerModule';

import { LidarScannerViewProps } from './LidarScanner.types';

const NativeView: React.ComponentType<LidarScannerViewProps> =
  requireNativeView('LidarScanner');

export default function LidarScannerView(props: LidarScannerViewProps) {
  return <NativeView {...props} />;
}

export function previewModel(url: string) {
  return LidarScannerModule.previewModel(url);
}
