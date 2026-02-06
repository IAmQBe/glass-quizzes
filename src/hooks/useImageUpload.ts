import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseImageUploadReturn {
  uploadImage: (file: File) => Promise<string>;
  isUploading: boolean;
  progress: number;
  error: string | null;
}

export const useImageUpload = (): UseImageUploadReturn => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadImage = useCallback(async (file: File): Promise<string> => {
    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        throw new Error('Неподдерживаемый формат. Используйте JPG, PNG, GIF или WebP');
      }

      // Validate file size (5MB max)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error('Файл слишком большой. Максимум 5MB');
      }

      setProgress(10);

      // Generate unique filename
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const timestamp = Date.now();
      const randomId = crypto.randomUUID().slice(0, 8);
      const fileName = `${timestamp}-${randomId}.${ext}`;

      setProgress(30);

      // Try to upload to Supabase Storage
      try {
        const { data, error: uploadError } = await supabase.storage
          .from('quiz-images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          // Check if bucket doesn't exist
          if (uploadError.message?.includes('Bucket not found') ||
            uploadError.message?.includes('bucket') ||
            uploadError.message?.includes('not found')) {
            console.warn('Storage bucket not found, falling back to data URL');
            // Fall back to data URL
            return await fileToDataUrl(file);
          }
          throw uploadError;
        }

        setProgress(80);

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('quiz-images')
          .getPublicUrl(fileName);

        if (!urlData?.publicUrl) {
          throw new Error('Не удалось получить URL изображения');
        }

        setProgress(100);
        return urlData.publicUrl;
      } catch (storageError: any) {
        console.warn('Storage upload failed, using data URL:', storageError);
        // Fall back to data URL if storage fails
        return await fileToDataUrl(file);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка загрузки';
      setError(message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { uploadImage, isUploading, progress, error };
};

/**
 * Convert file to data URL (fallback when storage is unavailable)
 */
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Helper to resize image before upload (optional optimization)
export const resizeImage = (file: File, maxWidth: number = 1200): Promise<File> => {
  return new Promise((resolve, reject) => {
    const isGif = file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");
    if (isGif) {
      resolve(file);
      return;
    }

    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;

      // Only resize if larger than maxWidth
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const resizedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });
            resolve(resizedFile);
          } else {
            reject(new Error('Failed to resize image'));
          }
        },
        file.type,
        0.9 // Quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};
