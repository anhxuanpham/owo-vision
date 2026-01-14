import sharp, { type Sharp } from "sharp";

/**
 * Configuration for image preprocessing
 */
export interface PreprocessConfig {
    /**
     * Target width in pixels
     */
    width: number;
    /**
     * Target height in pixels
     */
    height: number;
    /**
     * Number of color channels (1 for grayscale, 3 for RGB)
     */
    channels: 1 | 3 | 4;
    /**
     * Threshold value for binarization (0-255)
     */
    threshold: number;
    /**
     * Background color for padding
     */
    backgroundColor?: { r: number; g: number; b: number; alpha: number };
}

/**
 * Result of image preprocessing
 */
export interface PreprocessResult {
    data: Float32Array;
    width: number;
    height: number;
    channels: number;
}

/**
 * Image preprocessing service for Huntbot captcha solver
 */
export class ImagePreprocessor {
    private static readonly DEFAULTS: Required<PreprocessConfig> = {
        width: 160,
        height: 64,
        channels: 1,
        threshold: 254,
        backgroundColor: { r: 0, g: 0, b: 0, alpha: 0 },
    };

    private readonly config: Required<PreprocessConfig>;

    constructor(config?: Partial<PreprocessConfig>) {
        this.config = {
            ...ImagePreprocessor.DEFAULTS,
            ...config,
        };
    }

    /**
     * Preprocess an image buffer for model input
     */
    public async preprocess(imageBuffer: Buffer): Promise<PreprocessResult> {
        try {
            // Load image and ensure alpha channel
            let image = sharp(imageBuffer).ensureAlpha();
            const metadata = await image.metadata();

            if (!metadata.width || !metadata.height) {
                throw new Error("Unable to read image dimensions");
            }

            console.log(`Original image: ${metadata.width}x${metadata.height}`);

            // Extract region if image is larger than target
            if (metadata.width > this.config.width || metadata.height > this.config.height) {
                image = this.extractCenterRegion(
                    imageBuffer,
                    metadata.width,
                    metadata.height
                );
            }

            // Get dimensions after extraction
            const extractedMetadata = await image.metadata();
            const currentWidth = extractedMetadata.width ?? 0;
            const currentHeight = extractedMetadata.height ?? 0;

            // Pad to target dimensions if needed
            const paddingX = this.config.width - currentWidth;
            const paddingY = this.config.height - currentHeight;

            if (paddingX > 0 || paddingY > 0) {
                image = this.padImage(image, paddingX, paddingY);
            }

            // Apply threshold and get raw pixel data
            const { data, info } = await image
                .threshold(this.config.threshold)
                .raw()
                .toBuffer({ resolveWithObject: true });

            console.log(`Processed image: ${info.width}x${info.height}, channels: ${info.channels}`);

            // Normalize pixel values
            const normalized = this.normalize(
                data,
                info.width,
                info.height,
                info.channels
            );

            return {
                data: normalized,
                width: info.width,
                height: info.height,
                channels: this.config.channels,
            };
        } catch (error) {
            throw new Error(
                `Image preprocessing failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Extract center region from image
     */
    private extractCenterRegion(
        imageBuffer: Buffer,
        imgWidth: number,
        imgHeight: number
    ): Sharp {
        const targetWidth = Math.min(imgWidth, this.config.width);
        const targetHeight = Math.min(imgHeight, this.config.height);

        const left = Math.max(0, Math.floor((imgWidth - targetWidth) / 2));
        const top = Math.max(0, Math.floor((imgHeight - targetHeight) / 2));

        console.log(`Extracting region: left=${left}, top=${top}, width=${targetWidth}, height=${targetHeight}`);

        return sharp(imageBuffer).extract({
            left,
            top,
            width: targetWidth,
            height: targetHeight,
        });
    }

    /**
     * Pad image to center it within target dimensions
     */
    private padImage(image: Sharp, paddingX: number, paddingY: number): Sharp {
        const padLeft = Math.max(0, Math.floor(paddingX / 2));
        const padTop = Math.max(0, Math.floor(paddingY / 2));
        const padRight = Math.max(0, paddingX - padLeft);
        const padBottom = Math.max(0, paddingY - padTop);

        console.log(`Padding: left=${padLeft}, top=${padTop}, right=${padRight}, bottom=${padBottom}`);

        return image.extend({
            left: padLeft,
            top: padTop,
            right: padRight,
            bottom: padBottom,
            background: this.config.backgroundColor,
        });
    }

    /**
     * Normalize pixel values to 0 or 1 based on alpha channel
     */
    private normalize(
        buffer: Buffer,
        width: number,
        height: number,
        channels: number
    ): Float32Array {
        const targetSize = width * height * this.config.channels;
        const normalized = new Float32Array(targetSize);

        // Process based on alpha channel (4th channel)
        // Pixel is "on" (1) if alpha is below threshold, otherwise "off" (0)
        for (let i = 0; i < buffer.length; i += channels) {
            const pixelIndex = i / channels;
            if (pixelIndex < targetSize) {
                const alphaValue = buffer[i + 3] ?? 255; // Default to opaque if no alpha
                normalized[pixelIndex] = alphaValue < this.config.threshold ? 1.0 : 0.0;
            }
        }

        return normalized;
    }

    /**
     * Get current configuration
     */
    public getConfig(): Readonly<Required<PreprocessConfig>> {
        return { ...this.config };
    }
}

/**
 * Convenience function for preprocessing with default configuration
 */
export const huntbotPreprocess = async (
    imageBuffer: Buffer,
    width?: number,
    height?: number,
    channels?: 1 | 3 | 4,
    threshold?: number
): Promise<Float32Array> => {
    const preprocessor = new ImagePreprocessor({
        ...(width !== undefined && { width }),
        ...(height !== undefined && { height }),
        ...(channels !== undefined && { channels }),
        ...(threshold !== undefined && { threshold }),
    });

    const result = await preprocessor.preprocess(imageBuffer);
    return result.data;
};

/**
 * Create a reusable preprocessor instance
 */
export const createPreprocessor = (config?: Partial<PreprocessConfig>): ImagePreprocessor => {
    return new ImagePreprocessor(config);
};
