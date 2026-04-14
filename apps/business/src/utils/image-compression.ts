import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export async function compressImage(
  imageUri: string,
  maxWidth: number = 1200,
  quality: number = 0.8,
): Promise<{ uri: string; width: number; height: number; size: number }> {
  const infoRef = await ImageManipulator.manipulate(imageUri).renderAsync();
  const srcWidth = infoRef.width;
  const srcHeight = infoRef.height;

  let targetWidth = srcWidth;
  let targetHeight = srcHeight;

  if (srcWidth > maxWidth) {
    targetWidth = maxWidth;
    targetHeight = Math.round(srcHeight * (maxWidth / srcWidth));
  }

  const ctx = ImageManipulator.manipulate(imageUri);
  if (targetWidth !== srcWidth) {
    ctx.resize({ width: targetWidth, height: targetHeight });
  }

  const imageRef = await ctx.renderAsync();
  const result = await imageRef.saveAsync({ compress: quality, format: SaveFormat.JPEG });

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    size: 0,
  };
}
