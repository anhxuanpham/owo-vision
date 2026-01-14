import { BaseDecoder, type DecodedResult, type DecoderConfig } from "@/services/interfaces/decoder.interface.js";

/**
 * Huntbot-specific decoder configuration
 */
export interface HuntbotDecoderConfig extends DecoderConfig {
    depth: number;
    minConfidence?: number;
}

/**
 * Huntbot one-hot decoder
 * Decodes model output from one-hot encoded format to characters
 */
export class HuntbotDecoder extends BaseDecoder<Float32Array, string, HuntbotDecoderConfig> {
    constructor(config?: Partial<HuntbotDecoderConfig>) {
        super({
            depth: 27,
            minConfidence: 0,
            ...config,
        } as HuntbotDecoderConfig);
    }

    public decode(array: Float32Array, config?: HuntbotDecoderConfig): DecodedResult<string>[] {
        const finalConfig = { ...this.defaultConfig, ...config };
        const { depth, minConfidence = 0 } = finalConfig;

        if (array.length === 0) {
            throw new Error("Input array cannot be empty");
        }

        if (array.length % depth !== 0) {
            throw new Error(
                `Array length (${array.length}) must be divisible by depth (${depth})`
            );
        }

        const numPositions = array.length / depth;
        const result: DecodedResult<string>[] = [];

        for (let position = 0; position < numPositions; position++) {
            const startIndex = position * depth;
            let maxConfidence = -Infinity;
            let maxIndex = -1;

            // Find the index with maximum confidence
            for (let offset = 0; offset < depth; offset++) {
                const confidence = array[startIndex + offset];
                if (confidence !== undefined && confidence > maxConfidence) {
                    maxConfidence = confidence;
                    maxIndex = offset;
                }
            }

            // Only include results above minimum confidence threshold
            if (maxConfidence >= minConfidence && maxIndex !== -1) {
                result.push({
                    value: this.decodeChar(maxIndex),
                    confidence: maxConfidence,
                    position,
                });
            }
        }

        return result;
    }

    /**
     * Decode character code to lowercase letter
     */
    private decodeChar(code: number): string {
        if (code < 0 || code >= 26) {
            return "?"; // Unknown character
        }
        return String.fromCharCode(code + "a".charCodeAt(0));
    }
}
