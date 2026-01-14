/**
 * Decoded character with confidence and position information
 */
export interface DecodedCharacter {
    char: string;
    confidence: number;
    position: number;
}

/**
 * Options for decoding one-hot encoded arrays
 */
export interface DecodeOptions {
    /**
     * Number of possible values per position (vocabulary size)
     */
    depth: number;
    /**
     * Function to convert numeric code to character
     */
    decoder: (code: number) => string;
    /**
     * Minimum confidence threshold (0-1). Results below this are filtered out.
     */
    minConfidence?: number;
}

/**
 * Decodes a one-hot encoded array into characters with confidence scores
 * 
 * @param array - Flattened one-hot encoded array
 * @param options - Decoding configuration
 * @returns Array of decoded characters with confidence scores
 * 
 * @example
 * ```typescript
 * const result = onehotDecode(predictions, {
 *   depth: 27,
 *   decoder: (code) => String.fromCharCode(code + 97),
 *   minConfidence: 0.5
 * });
 * ```
 */
export const onehotDecode = (
    array: number[] | Float32Array,
    options: DecodeOptions,
): DecodedCharacter[] => {
    const { depth, decoder, minConfidence = 0 } = options;

    if (array.length === 0) {
        throw new Error("Input array cannot be empty");
    }

    if (array.length % depth !== 0) {
        throw new Error(
            `Array length (${array.length}) must be divisible by depth (${depth})`
        );
    }

    const numPositions = array.length / depth;
    const result: DecodedCharacter[] = [];

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
                char: decoder(maxIndex),
                confidence: maxConfidence,
                position,
            });
        }
    }

    return result;
};

/**
 * Simple decoder for lowercase letters (a-z)
 */
export const lowercaseDecoder = (code: number): string => {
    if (code < 0 || code > 25) {
        return "?"; // Unknown character
    }
    return String.fromCharCode(code + 97); // 97 is 'a'
};

/**
 * Decoder for alphanumeric characters (0-9, a-z, space)
 */
export const alphanumericDecoder = (code: number): string => {
    if (code === 0) return " "; // Space
    if (code >= 1 && code <= 10) return String(code - 1); // 0-9
    if (code >= 11 && code <= 36) return String.fromCharCode(code + 86); // a-z
    return "?";
};

/**
 * Converts decoded results to a simple string
 */
export const decodeToString = (results: DecodedCharacter[]): string => {
    return results.map(r => r.char).join("");
};

/**
 * Gets the average confidence of decoded results
 */
export const getAverageConfidence = (results: DecodedCharacter[]): number => {
    if (results.length === 0) return 0;
    const sum = results.reduce((acc, r) => acc + r.confidence, 0);
    return sum / results.length;
};
