import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Compress and resize an image
 * @param imageUri - local file URI of the image
 * @param maxWidth - maximum width in pixels (default: 1200)
 * @param quality - JPEG quality 0-1 (default: 0.8)
 * @returns compressed image URI and data
 */
export async function compressImage(
  imageUri: string,
  maxWidth: number = 1200,
  quality: number = 0.8,
): Promise<{ uri: string; width: number; height: number; size: number }> {
  try {
    // Get image info
    const info = await ImageManipulator.manipulateAsync(imageUri, [], { compress: quality });

    // Calculate new dimensions (maintaining aspect ratio)
    let { width, height } = info;
    if (width > maxWidth) {
      const ratio = maxWidth / width;
      width = maxWidth;
      height = Math.round(height * ratio);
    }

    // Resize if needed
    if (width !== info.width || height !== info.height) {
      const result = await ImageManipulator.manipulateAsync(imageUri, [{ resize: { width, height } }], {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      });

      return {
        uri: result.uri,
        width,
        height,
        size: result.size || 0,
      };
    }

    // Just re-compress if no resize needed
    const result = await ImageManipulator.manipulateAsync(imageUri, [], {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    return {
      uri: result.uri,
      width: info.width,
      height: info.height,
      size: result.size || 0,
    };
  } catch (error) {
    console.error('[ImageCompression] Failed to compress image:', error);
    throw error;
  }
}
