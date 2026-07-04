import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export async function pickImage(aspect: [number, number] = [1, 1]): Promise<ImagePicker.ImagePickerAsset | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permission to access photos was denied.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 0.8,
    base64: true, // ← ask expo-image-picker to return base64 directly
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0];
}

export async function uploadImage(
  asset: ImagePicker.ImagePickerAsset,
  bucket: string,
  userId: string,
  fileName: string
): Promise<string> {
  // Use base64 directly from the asset — no file system read needed
  const base64 = asset.base64;
  if (!base64) throw new Error('No base64 data in image asset.');

  const uri = asset.uri;
  const ext = uri.split('.').pop()?.toLowerCase().split('?')[0] ?? 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
  const path = `${userId}/${fileName}.${ext}`;

  // Decode base64 → Uint8Array
  const byteChars = atob(base64);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteArray[i] = byteChars.charCodeAt(i);
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, byteArray, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function pickAndUpload(
  bucket: string,
  userId: string,
  fileName: string,
  aspect: [number, number] = [1, 1]
): Promise<string | null> {
  const asset = await pickImage(aspect);
  if (!asset) return null;
  return await uploadImage(asset, bucket, userId, fileName);
}