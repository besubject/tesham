import { apiClient } from '@mettig/shared';
import { compressImage } from './image-compression';

/**
 * Upload a photo to S3 via signed URL
 * @param imageUri - local image URI
 * @param type - 'photo' or 'portfolio'
 * @param fileName - original file name
 * @returns public URL to the uploaded photo
 */
export async function uploadPhoto(
  imageUri: string,
  type: 'photo' | 'portfolio',
  fileName: string,
): Promise<string> {
  try {
    // Step 1: Compress image
    console.log('[PhotoUpload] Compressing image...');
    const compressed = await compressImage(imageUri, 1200, 0.8);
    console.log(
      `[PhotoUpload] Compressed: ${compressed.width}x${compressed.height}, size: ${compressed.size} bytes`,
    );

    // Step 2: Get signed upload URL from backend
    console.log('[PhotoUpload] Requesting signed URL...');
    const response = await apiClient.get<{ uploadUrl: string }>('/upload-url', {
      params: { type, fileName },
    });

    if (!response.data.uploadUrl) {
      throw new Error('Failed to get signed upload URL');
    }

    const { uploadUrl } = response.data;
    console.log('[PhotoUpload] Got signed URL, uploading...');

    // Step 3: Upload directly to S3 using signed URL
    const fileResponse = await fetch(compressed.uri);
    const blob = await fileResponse.blob();

    const s3Response = await fetch(uploadUrl, {
      method: 'PUT',
      body: blob,
      headers: {
        'Content-Type': 'image/jpeg',
      },
    });

    if (!s3Response.ok) {
      throw new Error(`S3 upload failed: ${s3Response.status} ${s3Response.statusText}`);
    }

    // Step 4: Return the public URL (without query params)
    const publicUrl = uploadUrl.split('?')[0] ?? uploadUrl;
    console.log('[PhotoUpload] Upload successful:', publicUrl);

    return publicUrl;
  } catch (error) {
    console.error('[PhotoUpload] Error:', error);
    throw error;
  }
}
