import { apiClient } from '@mettig/shared';
import { compressImage } from './image-compression';

export async function uploadPhoto(
  imageUri: string,
  type: 'photo' | 'portfolio',
  fileName: string,
): Promise<string> {
  const compressed = await compressImage(imageUri, 1200, 0.8);

  const response = await apiClient.get<{ uploadUrl: string }>('/upload-url', {
    params: { type, fileName },
  });

  if (!response.data.uploadUrl) {
    throw new Error('Failed to get signed upload URL');
  }

  const { uploadUrl } = response.data;

  const fileResponse = await fetch(compressed.uri);
  const blob = await fileResponse.blob();

  const s3Response = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': 'image/jpeg' },
  });

  if (!s3Response.ok) {
    throw new Error(`S3 upload failed: ${s3Response.status}`);
  }

  return uploadUrl.split('?')[0] ?? uploadUrl;
}
