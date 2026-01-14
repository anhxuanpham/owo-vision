import path from "node:path";
import { InferenceSession, Tensor } from "onnxruntime-node";
import { BaseONNXModelService, type ModelConfig, type PredictionResult } from "@/services/interfaces/model.interface.js";
import { YOLOPreprocessor, type YOLOPreprocessConfig } from "./yolo.preprocessor.js";
import { YOLODecoder, type YOLODecoderConfig, type BoundingBox } from "./yolo.decoder.js";
import { container } from "@/container/container.js";
import { TOKENS } from "@/container/tokens.js";
import type { LoggerService } from "@/services/logger.service.js";

/**
 * YOLO model configuration
 */
export interface YOLOModelConfig extends ModelConfig {
    preprocessor: YOLOPreprocessConfig;
    decoder: YOLODecoderConfig;
}

/**
 * YOLO object detection service
 */
export class YOLOModelService extends BaseONNXModelService<Buffer, BoundingBox, YOLOModelConfig> {
    private static instance: YOLOModelService | null = null;

    private constructor(config?: Partial<YOLOModelConfig>) {
        const defaultConfig: YOLOModelConfig = {
            modelPath: path.resolve(process.cwd(), "src/models/yolo.onnx"),
            preprocessor: {
                width: 640,
                height: 640,
                channels: 3,
                normalize: true,
            },
            decoder: {
                numClasses: 80,
                classNames: [], // Would be loaded from COCO names
                minConfidence: 0.25,
            },
        };

        const finalConfig = {
            ...defaultConfig,
            ...config,
            preprocessor: { ...defaultConfig.preprocessor, ...config?.preprocessor },
            decoder: { ...defaultConfig.decoder, ...config?.decoder },
        };

        const preprocessor = new YOLOPreprocessor(finalConfig.preprocessor);
        const decoder = new YOLODecoder(finalConfig.decoder);
        const logger = container.resolve<LoggerService>(TOKENS.Logger);

        super(finalConfig, preprocessor, decoder, logger);
    }

    public static getInstance(config?: Partial<YOLOModelConfig>): YOLOModelService {
        if (!YOLOModelService.instance) {
            YOLOModelService.instance = new YOLOModelService(config);
        }
        return YOLOModelService.instance;
    }

    protected async loadModel(): Promise<void> {
        try {
            this.session = await InferenceSession.create(this.config.modelPath);
            this.logger.info("✓ YOLO model loaded successfully");
        } catch (error) {
            this.logger.error("Failed to load YOLO model:", error);
            throw new Error("Failed to initialize YOLO model");
        }
    }

    public async predict(imageBuffer: Buffer): Promise<PredictionResult<BoundingBox>> {
        const startTime = performance.now();

        try {
            await this.initialize();

            if (!this.session) {
                throw new Error("Session not initialized");
            }

            // Preprocess image
            const preprocessed = await this.preprocessor.preprocess(imageBuffer);

            // Create input tensor (NCHW format for YOLO)
            const inputTensor = new Tensor("float32", preprocessed.data, [
                1,
                preprocessed.channels,
                preprocessed.height,
                preprocessed.width,
            ]);

            // Run inference
            const outputs = await this.session.run({
                [this.session.inputNames[0]!]: inputTensor,
            });

            const outputTensor = outputs[this.session.outputNames[0]!];
            if (!outputTensor) {
                throw new Error("No output from model");
            }

            const raw = outputTensor.data as Float32Array;

            // Decode results
            const results = this.decoder.decode(raw);

            const inferenceTime = performance.now() - startTime;

            return {
                results,
                raw,
                inferenceTime,
            };
        } catch (error) {
            this.logger.error("Error during YOLO inference:", error);
            throw new Error(
                `Failed to run YOLO detection: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async dispose(): Promise<void> {
        await super.dispose();
        YOLOModelService.instance = null;
    }

    public static reset(): void {
        YOLOModelService.instance = null;
    }
}
