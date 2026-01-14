import type { LoggerService } from "@/services/logger.service.js";

/**
 * Generic configuration for image preprocessing
 */
export interface PreprocessConfig {
    width: number;
    height: number;
    channels: 1 | 3 | 4;
    [key: string]: any; // Allow model-specific config
}

/**
 * Result of preprocessing operation
 */
export interface PreprocessResult<T = Float32Array> {
    data: T;
    width: number;
    height: number;
    channels: number;
    metadata?: Record<string, any>;
}

/**
 * Base interface for all preprocessors
 */
export interface IPreprocessor<TConfig extends PreprocessConfig = PreprocessConfig, TResult = Float32Array> {
    /**
     * Preprocess input data (image buffer, tensor, etc.)
     */
    preprocess(input: Buffer): Promise<PreprocessResult<TResult>>;

    /**
     * Get preprocessor configuration
     */
    getConfig(): Readonly<TConfig>;

    /**
     * Validate input before processing
     */
    validate?(input: Buffer): Promise<boolean> | boolean;
}

/**
 * Abstract base class for preprocessors
 */
export abstract class BasePreprocessor<TConfig extends PreprocessConfig = PreprocessConfig, TResult = Float32Array> implements IPreprocessor<TConfig, TResult> {
    protected readonly config: Required<TConfig>;
    protected readonly logger: LoggerService | undefined;

    constructor(config: TConfig, defaults: Required<TConfig>, logger?: LoggerService) {
        this.config = { ...defaults, ...config };
        this.logger = logger;
    }

    abstract preprocess(input: Buffer): Promise<PreprocessResult<TResult>>;

    public getConfig(): Readonly<Required<TConfig>> {
        return { ...this.config };
    }

    public validate(input: Buffer): boolean {
        return Buffer.isBuffer(input) && input.length > 0;
    }
}
