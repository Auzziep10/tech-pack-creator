export type LidarScannerViewProps = {
  isScanning: boolean;
  onCaptureComplete?: (event: { nativeEvent: { url?: string; error?: string } }) => void;
  style?: any;
};
