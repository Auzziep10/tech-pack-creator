import ExpoModulesCore
import QuickLook

public class LidarScannerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LidarScanner")

    View(LidarScannerView.self) {
      Events("onCaptureComplete")

      // Expose an 'isScanning' prop to React Native
      Prop("isScanning") { (view: LidarScannerView, isScanning: Bool) in
        if isScanning {
          view.startSession()
        } else {
          view.stopSession()
        }
      }
    }
    
    // Natively trigger Apple's high-fidelity 3D QuickLook previewer!
    Function("previewModel") { (urlStr: String) in
        guard let url = URL(string: urlStr) else { return }
        
        DispatchQueue.main.async {
            if let window = UIApplication.shared.windows.first(where: { $0.isKeyWindow }),
               let rootVC = window.rootViewController {
                
                let previewController = PreviewController()
                previewController.previewUrl = url
                
                // Present over topmost view controller
                var topController = rootVC
                while let presented = topController.presentedViewController {
                    topController = presented
                }
                topController.present(previewController, animated: true)
            }
        }
    }
  }
}

// A simple QLPreviewController wrapper to feed it the USDZ file
class PreviewController: UIViewController, QLPreviewControllerDataSource, QLPreviewControllerDelegate {
    var previewUrl: URL?
    
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        
        let qlController = QLPreviewController()
        qlController.dataSource = self
        qlController.delegate = self
        self.present(qlController, animated: true)
    }
    
    func previewControllerDidDismiss(_ controller: QLPreviewController) {
        self.dismiss(animated: false, completion: nil)
    }
    
    func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
        return self.previewUrl != nil ? 1 : 0
    }
    
    func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
        return self.previewUrl! as QLPreviewItem
    }
}
