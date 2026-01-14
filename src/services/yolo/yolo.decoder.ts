import { BaseDecoder, type DecodedResult, type DecoderConfig } from "@/services/interfaces/decoder.interface.js";

/**
 * Bounding box for object detection
 */
export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
    class: string;
    confidence: number;
}

/**
 * YOLO-specific decoder configuration
 */
export interface YOLODecoderConfig extends DecoderConfig {
    numClasses: number;
    classNames: string[];
    iouThreshold?: number;
    minConfidence?: number;
}

/**
 * YOLO output decoder
 * Decodes bounding boxes and applies NMS
 */
export class YOLODecoder extends BaseDecoder<Float32Array, BoundingBox, YOLODecoderConfig> {
    constructor(config: YOLODecoderConfig) {
        super({
            iouThreshold: 0.45,
            minConfidence: 0.25,
            ...config,
        } as YOLODecoderConfig);
    }

    public decode(array: Float32Array, config?: YOLODecoderConfig): DecodedResult<BoundingBox>[] {
        const finalConfig = { ...this.defaultConfig, ...config };
        const results: DecodedResult<BoundingBox>[] = [];

        // This is a simplified example - actual YOLO decoding is more complex
        // You would implement proper box decoding and NMS here

        // Example structure
        const numBoxes = array.length / (5 + finalConfig.numClasses);

        for (let i = 0; i < numBoxes; i++) {
            const offset = i * (5 + finalConfig.numClasses);
            const x = array[offset]!;
            const y = array[offset + 1]!;
            const w = array[offset + 2]!;
            const h = array[offset + 3]!;
            const objectness = array[offset + 4]!;

            if (objectness < finalConfig.minConfidence!) continue;

            // Find best class
            let maxClassProb = -Infinity;
            let maxClassIdx = -1;

            for (let c = 0; c < finalConfig.numClasses; c++) {
                const prob = array[offset + 5 + c]!;
                if (prob > maxClassProb) {
                    maxClassProb = prob;
                    maxClassIdx = c;
                }
            }

            const confidence = objectness * maxClassProb;

            if (confidence >= finalConfig.minConfidence!) {
                results.push({
                    value: {
                        x,
                        y,
                        width: w,
                        height: h,
                        class: finalConfig.classNames[maxClassIdx] ?? `class_${maxClassIdx}`,
                        confidence,
                    },
                    confidence,
                    position: i,
                });
            }
        }

        return results;
    }

    public toString(results: DecodedResult<BoundingBox>[]): string {
        return results
            .map(r => `${r.value.class}: ${(r.confidence * 100).toFixed(2)}%`)
            .join(", ");
    }
}
