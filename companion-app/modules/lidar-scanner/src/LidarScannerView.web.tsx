import * as React from 'react';

import { LidarScannerViewProps } from './LidarScanner.types';

export default function LidarScannerView(props: LidarScannerViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
