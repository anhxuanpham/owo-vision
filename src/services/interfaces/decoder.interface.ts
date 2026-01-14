/**
 * Generic decoded result with confidence
 */
export interface DecodedResult<T = string> {
    value: T;
    confidence: number;
    position: number;
    metadata?: Record<string, any>;
}

/**
 * Configuration for decoders
 */
export interface DecoderConfig {
    minConfidence?: number;
    [key: string]: any; // Allow decoder-specific config
}

/**
 * Base interface for all decoders
 */
export interface IDecoder<TInput = Float32Array, TOutput = string, TConfig extends DecoderConfig = DecoderConfig> {
    /**
     * Decode model output to human-readable format
     */
    decode(input: TInput, config?: TConfig): DecodedResult<TOutput>[];

    /**
     * Convert decoded results to string representation
     */
    toString(results: DecodedResult<TOutput>[]): string;

    /**
     * Get average confidence of results
     */
    getAverageConfidence(results: DecodedResult<TOutput>[]): number;
}

/**
 * Abstract base class for decoders
 */
export abstract class BaseDecoder<TInput = Float32Array, TOutput = string, TConfig extends DecoderConfig = DecoderConfig> implements IDecoder<TInput, TOutput, TConfig> {
    protected readonly defaultConfig: TConfig;

    constructor(defaultConfig: TConfig) {
        this.defaultConfig = defaultConfig;
    }

    abstract decode(input: TInput, config?: TConfig): DecodedResult<TOutput>[];

    public toString(results: DecodedResult<TOutput>[]): string {
        return results.map(r => String(r.value)).join("");
    }

    public getAverageConfidence(results: DecodedResult<TOutput>[]): number {
        if (results.length === 0) return 0;
        const sum = results.reduce((acc, r) => acc + r.confidence, 0);
        return sum / results.length;
    }
}
