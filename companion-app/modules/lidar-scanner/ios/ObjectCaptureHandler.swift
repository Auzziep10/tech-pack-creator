import SwiftUI
import RealityKit
import Combine

@available(iOS 17.0, *)
public struct GarmentScannerView: View {
    @State private var session = ObjectCaptureSession()
    var onComplete: (URL?) -> Void
    
    @State private var isProcessing = false
    @State private var progress: Double = 0.0
    @State private var captureDirectory: URL? = nil

    public var body: some View {
        ZStack {
            if !isProcessing {
                ObjectCaptureView(session: session)
                    .edgesIgnoringSafeArea(.all)
                    .onAppear {
                        let paths = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)
                        let dir = paths[0].appendingPathComponent("Scans-\(UUID().uuidString)")
                        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
                        self.captureDirectory = dir
                        
                        var config = ObjectCaptureSession.Configuration()
                        session.start(imagesDirectory: dir, configuration: config)
                    }
                
                VStack {
                    Spacer()
                    if case .initializing = session.state {
                        VStack(spacing: 12) {
                            ProgressView().scaleEffect(1.5).padding()
                            Text("Warming up LiDAR...").font(.headline).foregroundColor(.white)
                            if !session.feedback.isEmpty {
                                Text(String(describing: session.feedback)).font(.caption).foregroundColor(.yellow)
                            }
                        }.padding().background(Color.black.opacity(0.7)).cornerRadius(20)
                    } else if case .ready = session.state {
                        Button(action: {
                            session.startCapturing()
                        }) {
                            Text("Start Garment Scan")
                                .font(.headline).foregroundColor(.white)
                                .padding(.horizontal, 40).padding(.vertical, 16)
                                .background(Color.blue).clipShape(Capsule())
                        }
                    } else if case .capturing = session.state {
                        VStack(spacing: 20) {
                            Button(action: {
                                session.finish()
                            }) {
                                Text("Finish Scan & Build 3D Model")
                                    .font(.headline).foregroundColor(.white)
                                    .padding(.horizontal, 40).padding(.vertical, 16)
                                    .background(Color.green).clipShape(Capsule())
                            }
                        }
                    } else if case .completed = session.state {
                        Color.clear.task {
                            isProcessing = true
                            guard let imagesDir = captureDirectory else {
                                onComplete(nil)
                                return
                            }
                            processPhotogrammetry(imagesDir: imagesDir)
                        }
                    }
                }.padding(.bottom, 50)
            } else {
                VStack(spacing: 20) {
                    ProgressView().scaleEffect(2.0)
                    Text("Building Photorealistic 3D Model...")
                        .font(.headline)
                    Text("\(Int(progress * 100))%")
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.black.ignoresSafeArea())
                .foregroundColor(.white)
            }
        }
    }
    
    func processPhotogrammetry(imagesDir: URL) {
        let paths = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)
        let modelUrl = paths[0].appendingPathComponent("Garment-\(UUID().uuidString).usdz")
        
        Task {
            do {
                var pSession = try PhotogrammetrySession(input: imagesDir, configuration: PhotogrammetrySession.Configuration())
                try pSession.process(requests: [.modelFile(url: modelUrl)])
                
                for try await output in pSession.outputs {
                    switch output {
                    case .processingComplete:
                        DispatchQueue.main.async {
                            onComplete(modelUrl)
                        }
                    case .requestProgress(_, let fractionComplete):
                        DispatchQueue.main.async {
                            self.progress = fractionComplete
                        }
                    default:
                        break
                    }
                }
            } catch {
                DispatchQueue.main.async {
                    onComplete(nil)
                }
            }
        }
    }
}
