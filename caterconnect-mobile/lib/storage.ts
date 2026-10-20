import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

export async function pickImage(
  aspect: [number, number] = [1, 1]
): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Permission to access photos was denied.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 0.8,
    base64: true,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0];
}

export async function uploadImage(
  asset: ImagePicker.ImagePickerAsset,
  bucket: string,
  userId: string,
  fileName: string
): Promise<string> {
  if (!asset.base64) {
    throw new Error('The selected image did not contain upload data. Please choose another photo.');
  }

  // Cropped images usually arrive as JPEG, even when the original was PNG/HEIC.
  const mimeType = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  const extension = mimeType === 'image/png' ? 'png' : 'jpg';
  const safeName = fileName.replace(/[^a-zA-Z0-9_-]/g, '_');
  // A new object path avoids old-image caching and does not require Storage UPDATE permission.
  const path = `${userId}/${safeName}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, decode(asset.base64), {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Image upload failed: ${uploadError.message}`);
  }

  // This URL is usable only when the selected Storage bucket is public.
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error('Image uploaded but no public URL was returned.');
  }
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
  return uploadImage(asset, bucket, userId, fileName);
}
