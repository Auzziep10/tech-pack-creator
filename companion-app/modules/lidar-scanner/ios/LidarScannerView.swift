import ExpoModulesCore
import SwiftUI

class LidarScannerView: ExpoView {
  
  let onCaptureComplete = EventDispatcher()
  
  lazy var hostingController: UIViewController? = {
    if #available(iOS 17.0, *) {
      let captureView = GarmentScannerView(onComplete: { [weak self] (url: URL?) in
        DispatchQueue.main.async {
            self?.hostingController?.dismiss(animated: true) {
                if let outputUrl = url {
                    self?.onCaptureComplete([
                        "url": outputUrl.absoluteString
                    ])
                } else {
                    self?.onCaptureComplete([
                        "error": "Failed to generate USDZ model"
                    ])
                }
            }
        }
      })
      let controller = UIHostingController(rootView: captureView)
      controller.modalPresentationStyle = .fullScreen
      return controller
    }
    return nil
  }()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    guard let controller = hostingController else { return }
    
    // Instead of fighting React Native's subview hierarchy to pass lifecycle hooks,
    // we launch the View Controller as a full-screen modal! This strictly enforces 
    // the system-level viewDidAppear firing, which wakes up the camera.
    if controller.presentingViewController == nil, let window = self.window, let rootVC = window.rootViewController {
        // Find topmost view controller to safely present over anything
        var topController = rootVC
        while let presented = topController.presentedViewController {
            topController = presented
        }
        
        topController.present(controller, animated: true)
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    // No longer adding it to bounds, it is presented modally above everything!
  }

  func startSession() {
  }

  func stopSession() {
  }
}

