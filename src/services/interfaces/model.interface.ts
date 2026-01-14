import type { InferenceSession } from "onnxruntime-node";
import type { IPreprocessor, PreprocessConfig } from "./preprocessor.interface.js";
import type { IDecoder, DecoderConfig, DecodedResult } from "./decoder.interface.js";
import type { LoggerService } from "@/services/logger.service.js";

/**
 * Base model configuration
 */
export interface ModelConfig {
    modelPath: string;
    preprocessor?: PreprocessConfig;
    decoder?: DecoderConfig;
}

/**
 * Model prediction result
 */
export interface PredictionResult<T = string> {
    results: DecodedResult<T>[];
    raw?: Float32Array;
    inferenceTime?: number;
}

/**
 * Base interface for ML model services
 */
export interface IModelService<TInput = Buffer, TOutput = string, TConfig extends ModelConfig = ModelConfig> {
    /**
     * Initialize the model (load weights, etc.)
     */
    initialize(): Promise<void>;

    /**
     * Run inference on input data
     */
    predict(input: TInput): Promise<PredictionResult<TOutput>>;

    /**
     * Predict and return simple string output
     */
    predictAsString(input: TInput): Promise<string>;

    /**
     * Check if model is initialized
     */
    isInitialized(): boolean;

    /**
     * Get model configuration
     */
    getConfig(): Readonly<TConfig>;

    /**
     * Clean up resources
     */
    dispose(): Promise<void>;
}

/**
 * Abstract base class for ONNX-based model services
 */
export abstract class BaseONNXModelService<TInput = Buffer, TOutput = string, TConfig extends ModelConfig = ModelConfig> implements IModelService<TInput, TOutput, TConfig> {
    protected session: InferenceSession | null = null;
    protected initPromise: Promise<void> | null = null;
    protected readonly config: TConfig;
    protected readonly logger: LoggerService;
    public readonly preprocessor: IPreprocessor;
    public readonly decoder: IDecoder<Float32Array, TOutput>;

    constructor(
        config: TConfig,
        preprocessor: IPreprocessor,
        decoder: IDecoder<Float32Array, TOutput>,
        logger: LoggerService
    ) {
        this.config = config;
        this.preprocessor = preprocessor;
        this.decoder = decoder;
        this.logger = logger;
    }

    public async initialize(): Promise<void> {
        if (this.session) return;

        if (!this.initPromise) {
            this.initPromise = this.loadModel();
        }

        return this.initPromise;
    }

    protected abstract loadModel(): Promise<void>;

    public abstract predict(input: TInput): Promise<PredictionResult<TOutput>>;

    public async predictAsString(input: TInput): Promise<string> {
        const result = await this.predict(input);
        return this.decoder.toString(result.results);
    }

    public isInitialized(): boolean {
        return this.session !== null;
    }

    public getConfig(): Readonly<TConfig> {
        return { ...this.config };
    }

    public async dispose(): Promise<void> {
        if (this.session) {
            await this.session.release();
            this.session = null;
        }
        this.initPromise = null;
    }
}
