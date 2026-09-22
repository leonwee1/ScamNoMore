import * as ImagePicker from 'expo-image-picker';

/**
 * Expo-safe media helpers. All modules used here (expo-image-picker, and
 * expo-audio in the voice screen) are supported in Expo Go, so no custom
 * native code is required.
 */

export async function pickImage(fromCamera: boolean): Promise<string | null> {
  if (fromCamera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    return res.canceled ? null : res.assets[0].uri;
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  });
  return res.canceled ? null : res.assets[0].uri;
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

/** Pick an audio/document file. Falls back to library video if unavailable. */
export async function pickAudio(): Promise<string | null> {
  // expo-image-picker cannot pick pure audio; in Expo Go we accept a
  // video/audio asset from the library. A production build would add
  // expo-document-picker for arbitrary audio files.
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    quality: 0.7,
  });
  return res.canceled ? null : res.assets[0].uri;
}
