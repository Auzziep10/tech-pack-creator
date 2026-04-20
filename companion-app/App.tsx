import { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Easing, SafeAreaView, StatusBar, TextInput, ActivityIndicator } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import { LidarScannerView, previewModel } from './modules/lidar-scanner';
import { auth, storage, db } from './firebase';
import { signInWithEmailAndPassword, User } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import * as DocumentPicker from 'expo-document-picker';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    try {
      setIsLoggingIn(true);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      alert("Login Error: " + e.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const [scannedModelUrl, setScannedModelUrl] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<'mannequin' | 'flat' | null>(null);

  if (!user) {
    return (
      <View style={styles.loginContainer}>
        <StatusBar barStyle="dark-content" />
        <Text style={styles.title}>WOVN Companion</Text>
        <Text style={styles.subtitle}>Sign in to sync 3D scans directly to your firm's Cloud Inbox.</Text>
        
        <TextInput 
          style={styles.input} 
          placeholder="Email address" 
          value={email} 
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput 
          style={styles.input} 
          placeholder="Password" 
          value={password} 
          onChangeText={setPassword}
          secureTextEntry 
        />
        
        <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={isLoggingIn}>
          <Text style={styles.buttonText}>{isLoggingIn ? "Authenticating..." : "Sign In"}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.title}>LiDAR Scan Initialization</Text>
        <Text style={styles.subtitle}>
          To capture precise garment topography and 3D meshes, we need access to your camera.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleRetake = () => {
    setScannedModelUrl(null);
  };

  const handlePreview = () => {
    if (scannedModelUrl) {
      previewModel(scannedModelUrl);
    }
  };

  const handleSyncToTechPack = async () => {
    if (!scannedModelUrl || !user) return;
    try {
      setIsUploading(true);
      // Fetch local usdz file into a BLOB
      const response = await fetch(scannedModelUrl);
      const blob = await response.blob();
      
      const fileName = `scan_${Date.now()}.usdz`;
      const storageRef = ref(storage, `scans/${user.uid}/${fileName}`);
      
      // Upload
      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);
      
      // Create Database Record
      await addDoc(collection(db, `users/${user.uid}/pendingScans`), {
        url: downloadUrl,
        mode: scanMode,
        createdAt: serverTimestamp(),
        fileName,
        status: 'pending'
      });
      
      alert("Successfully pushed to Web Inbox!");
      setScannedModelUrl(null); // reset UI for next scan
      setScanMode(null);
    } catch (e: any) {
      alert("Upload failed: " + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {!scanMode ? (
        <View style={styles.reviewContainer}>
          <Text style={styles.title}>Select Scan Type</Text>
          <Text style={[styles.subtitle, { marginBottom: 40 }]}>Different orientations serve different needs in the final Tech Pack.</Text>
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e4e4e7', width: '100%', marginBottom: 16 }]} 
            onPress={() => setScanMode('mannequin')}
          >
            <Text style={{color: '#09090b', fontSize: 18, fontWeight: 'bold', marginBottom: 4}}>Mannequin / Vertical</Text>
            <Text style={{color: '#52525b', fontSize: 13, textAlign: 'center'}}>Best for full 3D visual renders. Walk 360° around.</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#f4f4f5', borderColor: '#e4e4e7', borderWidth: 1, width: '100%', marginBottom: 16 }]} 
            onPress={() => setScanMode('flat')}
          >
            <Text style={{color: '#09090b', fontSize: 18, fontWeight: 'bold', marginBottom: 4}}>Flat Lay / Tabletop</Text>
            <Text style={{color: '#52525b', fontSize: 13, textAlign: 'center'}}>Best for accurate pattern/seam mapping. (Tip: Slide thin cardboard inside to give slight depth).</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#ffffff', borderColor: '#d4d4d8', borderStyle: 'dashed', borderWidth: 1, width: '100%', marginBottom: 16 }]} 
            onPress={async () => {
              try {
                const res = await DocumentPicker.getDocumentAsync({ type: ['*/*'], copyToCacheDirectory: true });
                if (!res.canceled && res.assets && res.assets.length > 0) {
                  setScanMode('mannequin'); // Default to 3D mode tag
                  setScannedModelUrl(res.assets[0].uri);
                }
              } catch (err) {
                 alert("File picking failed.");
              }
            }}
          >
            <Text style={{color: '#09090b', fontSize: 16, fontWeight: 'bold', marginBottom: 4}}>Upload from Files</Text>
            <Text style={{color: '#52525b', fontSize: 12, textAlign: 'center'}}>Select a pre-existing .usdz or .obj file from iCloud Drive or On My iPhone.</Text>
          </TouchableOpacity>
        </View>
      ) : !scannedModelUrl ? (
        <>
          <View style={{position: 'absolute', top: 50, left: 20, zIndex: 100}}>
             <TouchableOpacity style={{backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e4e4e7'}} onPress={() => setScanMode(null)}>
               <Text style={{color: '#09090b', fontWeight: 'bold'}}>← Back</Text>
             </TouchableOpacity>
          </View>
          <LidarScannerView 
            style={styles.camera} 
            isScanning={true} 
            onCaptureComplete={(event) => {
              if (event.nativeEvent.url) {
                console.log("Model successfully generated at: ", event.nativeEvent.url);
                setScannedModelUrl(event.nativeEvent.url);
              } else {
                alert("Scan failed: " + event.nativeEvent.error);
                setScanMode(null);
              }
            }}
          />
        </>
      ) : (
        <View style={styles.reviewContainer}>
          <Text style={styles.title}>{scanMode === 'flat' ? 'Flat Scan' : '3D Scan'} Complete</Text>
          <Text style={styles.subtitle}>Your {scanMode === 'flat' ? 'pattern topography' : '3D garment mesh'} has been successfully reconstructed and textured.</Text>
          
          <TouchableOpacity style={[styles.primaryButton, { marginBottom: 16, width: '100%' }]} onPress={handlePreview}>
            <Text style={styles.buttonText}>Preview 3D Model</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.primaryButton, { backgroundColor: '#3b82f6', marginBottom: 32, width: '100%' }]}
            onPress={handleSyncToTechPack}
            disabled={isUploading}
          >
            <Text style={styles.buttonText}>{isUploading ? 'Uploading to Server...' : 'Sync to Tech Pack Creator'}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={handleRetake}>
            <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 16 }}>Discard & Rescan</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loginContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    padding: 32,
  },
  input: {
    height: 54,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    color: '#09090b',
  },
  reviewContainer: {
    flex: 1,
    backgroundColor: '#fafafa',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#fafafa',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#09090b',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#52525b',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#09090b',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  camera: {
    flex: 1,
    backgroundColor: '#ffffff'
  }
});
