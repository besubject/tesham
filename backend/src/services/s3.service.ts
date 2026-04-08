import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';

// ─── S3 Client initialization ──────────────────────────────────────────────

const s3Client = new S3Client({
  region: config.s3.region,
  endpoint: config.s3.endpoint,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
});

// ─── S3 Service ────────────────────────────────────────────────────────────

export class S3Service {
  /**
   * Generate a signed PUT URL for uploading a photo
   * @param type - 'photo' for business photos, 'portfolio' for portfolio images
   * @param businessId - business ID for path organization
   * @param fileName - original file name
   * @returns signed URL for PUT request
   */
  async generateUploadUrl(
    type: 'photo' | 'portfolio',
    businessId: string,
    fileName: string,
  ): Promise<string> {
    // Sanitize file name and create unique key
    const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const key = `${type}s/${businessId}/${timestamp}-${sanitized}`;

    const command = new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      ContentType: 'image/jpeg', // Assuming JPEG after client-side compression
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: config.s3.urlExpiration,
    });

    return signedUrl;
  }

  /**
   * Get the public URL for an uploaded photo
   * @param key - S3 object key
   * @returns public URL
   */
  getPhotoUrl(key: string): string {
    // For Yandex Object Storage or MinIO, construct the public URL
    // Assumes bucket is public or using signed URLs for access
    const baseUrl = config.s3.endpoint;
    return `${baseUrl}/${config.s3.bucket}/${key}`;
  }
}

export const s3Service = new S3Service();
