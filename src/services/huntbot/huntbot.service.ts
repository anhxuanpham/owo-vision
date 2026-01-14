import path from "node:path";
import { InferenceSession, Tensor } from "onnxruntime-node";
import { BaseONNXModelService, type ModelConfig, type PredictionResult } from "@/services/interfaces/model.interface.js";
import { HuntbotPreprocessor, type HuntbotPreprocessConfig } from "./huntbot.preprocessor.js";
import { HuntbotDecoder, type HuntbotDecoderConfig } from "./huntbot.decoder.js";
import { container } from "@/container/container.js";
import { TOKENS } from "@/container/tokens.js";
import type { LoggerService } from "@/services/logger.service.js";
import { getRootData } from "@sapphire/pieces";

/**
 * Huntbot model configuration
 */
export interface HuntbotModelConfig extends ModelConfig {
    preprocessor: HuntbotPreprocessConfig;
    decoder: HuntbotDecoderConfig;
}

/**
 * Huntbot captcha solver service
 * Uses ONNX model for inference
 */
export class HuntbotModelService extends BaseONNXModelService<Buffer, string, HuntbotModelConfig> {
    private static instance: HuntbotModelService | null = null;

    private constructor(config?: Partial<HuntbotModelConfig>) {
        const defaultConfig: HuntbotModelConfig = {
            modelPath: path.resolve(getRootData().root, "models/huntbot.onnx"),
            preprocessor: {
                width: 160,
                height: 64,
                channels: 1,
                threshold: 254,
            },
            decoder: {
                depth: 27,
                minConfidence: 0,
            },
        };

        const finalConfig = {
            ...defaultConfig,
            ...config,
            preprocessor: { ...defaultConfig.preprocessor, ...config?.preprocessor },
            decoder: { ...defaultConfig.decoder, ...config?.decoder },
        };

        const preprocessor = new HuntbotPreprocessor(finalConfig.preprocessor);
        const decoder = new HuntbotDecoder(finalConfig.decoder);
        const logger = container.resolve<LoggerService>(TOKENS.Logger);

        super(finalConfig, preprocessor, decoder, logger);
    }

    /**
     * Get singleton instance
     */
    public static getInstance(config?: Partial<HuntbotModelConfig>): HuntbotModelService {
        if (!HuntbotModelService.instance) {
            HuntbotModelService.instance = new HuntbotModelService(config);
        }
        return HuntbotModelService.instance;
    }

    /**
     * Load ONNX model
     */
    protected async loadModel(): Promise<void> {
        try {
            this.logger.debug(this.config.modelPath);
            this.session = await InferenceSession.create(this.config.modelPath);
            this.logger.info("✓ Huntbot model loaded successfully");
        } catch (error) {
            this.logger.error("Failed to load Huntbot model:", error);
            throw new Error("Failed to initialize Huntbot model");
        }
    }

    /**
     * Run inference on image
     */
    public async predict(imageBuffer: Buffer): Promise<PredictionResult<string>> {
        const startTime = performance.now();

        try {
            await this.initialize();

            if (!this.session) {
                throw new Error("Session not initialized");
            }

            // Preprocess image
            const preprocessed = await this.preprocessor.preprocess(imageBuffer);

            // Create input tensor
            const inputTensor = new Tensor("float32", preprocessed.data, [
                1,
                preprocessed.height,
                preprocessed.width,
                preprocessed.channels,
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
            this.logger.error("Error during Huntbot inference:", error);
            throw new Error(
                `Failed to solve Huntbot captcha: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Dispose and reset singleton
     */
    public async dispose(): Promise<void> {
        await super.dispose();
        HuntbotModelService.instance = null;
    }

    /**
     * Reset singleton instance
     */
    public static reset(): void {
        HuntbotModelService.instance = null;
    }
}
