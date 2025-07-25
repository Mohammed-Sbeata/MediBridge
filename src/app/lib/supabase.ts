import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// File upload utilities
export interface UploadResult {
  url: string;
  path: string;
  error?: string;
}

/**
 * Upload an audio file to Supabase storage
 * @param file - The audio file to upload
 * @param userId - User ID for file organization
 * @returns Promise with upload result
 */
export async function uploadAudioFile(file: Blob, userId: string): Promise<UploadResult> {
  try {
    const timestamp = Date.now();
    const fileName = `audio_${userId}_${timestamp}.webm`;
    const filePath = `audio/${userId}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('mdt-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading audio:', error);
      return { url: '', path: '', error: error.message };
    }

    // Get public URL
    const { data: publicData } = supabase.storage
      .from('mdt-files')
      .getPublicUrl(data.path);

    return {
      url: publicData.publicUrl,
      path: data.path,
    };
  } catch (error) {
    console.error('Unexpected error uploading audio:', error);
    return { 
      url: '', 
      path: '', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Upload an image file to Supabase storage
 * @param file - The image file to upload
 * @param userId - User ID for file organization
 * @returns Promise with upload result
 */
export async function uploadImageFile(file: File, userId: string): Promise<UploadResult> {
  try {
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `image_${userId}_${timestamp}.${fileExtension}`;
    const filePath = `images/${userId}/${fileName}`;

    // Check current auth session
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    const { data, error } = await supabase.storage
      .from('mdt-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading image:', error);
      return { url: '', path: '', error: error.message };
    }

    // Get public URL
    const { data: publicData } = supabase.storage
      .from('mdt-files')
      .getPublicUrl(data.path);

    return {
      url: publicData.publicUrl,
      path: data.path,
    };
  } catch (error) {
    console.error('Unexpected error uploading image:', error);
    return { 
      url: '', 
      path: '', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Delete a file from Supabase storage
 * @param filePath - The path of the file to delete
 * @returns Promise with deletion result
 */
export async function deleteFile(filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from('mdt-files')
      .remove([filePath]);

    if (error) {
      console.error('Error deleting file:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error deleting file:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
} 