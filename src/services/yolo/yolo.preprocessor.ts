import sharp from "sharp";
import { BasePreprocessor, type PreprocessConfig, type PreprocessResult } from "@/services/interfaces/preprocessor.interface.js";
import { container } from "@/container/container.js";
import { TOKENS } from "@/container/tokens.js";
import type { LoggerService } from "@/services/logger.service.js";

/**
 * YOLO-specific preprocessing configuration
 */
export interface YOLOPreprocessConfig extends PreprocessConfig {
    normalize: boolean;
    meanValues?: [number, number, number];
    stdValues?: [number, number, number];
}

/**
 * YOLO image preprocessor
 * Handles object detection preprocessing
 */
export class YOLOPreprocessor extends BasePreprocessor<YOLOPreprocessConfig> {
    private static readonly DEFAULTS: Required<YOLOPreprocessConfig> = {
        width: 640,
        height: 640,
        channels: 3,
        normalize: true,
        meanValues: [0.485, 0.456, 0.406],
        stdValues: [0.229, 0.224, 0.225],
    };

    constructor(config?: Partial<YOLOPreprocessConfig>) {
        const logger = container.resolve<LoggerService>(TOKENS.Logger);
        super(
            config as YOLOPreprocessConfig,
            YOLOPreprocessor.DEFAULTS,
            logger
        );
    }

    public async preprocess(imageBuffer: Buffer): Promise<PreprocessResult> {
        try {
            // Resize and convert to RGB
            const { data, info } = await sharp(imageBuffer)
                .resize(this.config.width, this.config.height, {
                    fit: "fill",
                })
                .removeAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });

            // Convert to Float32Array and normalize
            const normalized = this.normalize(data, info.channels);

            return {
                data: normalized,
                width: info.width,
                height: info.height,
                channels: info.channels,
                metadata: {
                    originalFormat: "RGB",
                    normalized: this.config.normalize,
                },
            };
        } catch (error) {
            throw new Error(
                `YOLO preprocessing failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Normalize pixel values using mean and std
     */
    private normalize(buffer: Buffer, channels: number): Float32Array {
        const size = buffer.length;
        const normalized = new Float32Array(size);

        for (let i = 0; i < size; i++) {
            const channelIdx = i % channels;
            const pixelValue = buffer[i]! / 255.0; // Scale to [0, 1]

            if (this.config.normalize) {
                // Normalize using mean and std
                normalized[i] =
                    (pixelValue - this.config.meanValues[channelIdx]!) /
                    this.config.stdValues[channelIdx]!;
            } else {
                normalized[i] = pixelValue;
            }
        }

        return normalized;
    }
}
