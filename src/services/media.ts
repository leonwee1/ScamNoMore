import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

/**
 * Expo-safe media helpers. All modules used here (expo-image-picker, and
 * expo-audio in the voice screen) are supported in Expo Go, so no custom
 * native code is required.
 */

export interface PickedImage {
  uri: string;
  /** Preserve the picker MIME when its cache URI has no useful extension. */
  mimeType?: string;
}

export async function pickImage(fromCamera: boolean): Promise<PickedImage | null> {
  if (fromCamera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    const asset = res.canceled ? undefined : res.assets[0];
    return asset ? { uri: asset.uri, ...(asset.mimeType ? { mimeType: asset.mimeType } : {}) } : null;
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  });
  const asset = res.canceled ? undefined : res.assets[0];
  return asset ? { uri: asset.uri, ...(asset.mimeType ? { mimeType: asset.mimeType } : {}) } : null;
}

export async function pickVideo(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    videoMaxDuration: 300, // 5 minutes per wireframe
    quality: 0.7,
  });
  return res.canceled ? null : res.assets[0].uri;
}

export interface PickedAudio {
  uri: string;
  /** DocumentPicker's MIME is more reliable than a cache URI's extension. */
  mimeType?: string;
}

/** Pick an actual audio file in Expo Go (MP3, M4A, WAV, or WebM). */
export async function pickAudio(): Promise<PickedAudio | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/webm'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = res.canceled ? undefined : res.assets[0];
  return asset ? { uri: asset.uri, ...(asset.mimeType ? { mimeType: asset.mimeType } : {}) } : null;
}
