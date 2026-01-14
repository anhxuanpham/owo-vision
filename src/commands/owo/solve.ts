import { downloadFile } from "@/utils/download.js";
import { container } from "@/container/container.js";
import { TOKENS } from "@/container/tokens.js";
import { HuntbotModelService } from "@/services/huntbot/index.js";
import { Subcommand } from "@sapphire/plugin-subcommands";
import { MessageFlags } from "discord.js";
import { fileTypeFromBuffer } from "file-type"

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ["image/png", "image/webp", "image/jpeg", "image/jpg"];
const DOWNLOAD_TIMEOUT = 10_000; // 10 seconds
const ALLOWED_DOMAINS = [
    "cdn.discordapp.com",
    "media.discordapp.net",
    "images-ext-1.discordapp.net",
    "images-ext-2.discordapp.net"
]

export class SolveCommand extends Subcommand {
    constructor(context: Subcommand.LoaderContext, options: Subcommand.Options) {
        super(context, {
            ...options,
            name: "solve",
            description: "Solves something mysterious.",
            subcommands: [
                {
                    name: "huntbot",
                    chatInputRun: "chatInputHuntbot",
                }
            ]
        });
    }

    public override registerApplicationCommands(registry: Subcommand.Registry): void {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName(this.name)
                .setDescription(this.description)
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName("huntbot")
                        .setDescription("Solve owo huntbot passwords.")
                        .addAttachmentOption((option) =>
                            option
                                .setName("image")
                                .setDescription("The image containing the huntbot password.")
                        )
                        .addStringOption((option) =>
                            option
                                .setName("url")
                                .setDescription("The URL of the image containing the huntbot password.")
                        )
                )
        );
    }

    async chatInputHuntbot(interaction: Subcommand.ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const attachment = interaction.options.getAttachment("image");
        const url = interaction.options.getString("url");

        if (!attachment && !url) {
            return interaction.editReply("Please provide either an image attachment or a URL.");
        }

        const imageUrl = attachment?.url ?? url;

        if (!imageUrl) {
            return interaction.editReply("Could not determine the image URL.");
        }

        try {
            // Download and validate the image
            const imageBuffer = await this.downloadAndValidateImage(imageUrl);

            // Get the Huntbot model service from container
            const huntbotModel = container.resolve<HuntbotModelService>(TOKENS.HuntbotModel);

            // Solve the captcha
            const result = await huntbotModel.predict(imageBuffer);

            // Format the response
            const password = result.results.map(r => r.value).join("");
            const avgConfidence = huntbotModel.decoder.getAverageConfidence(result.results);

            return interaction.editReply({
                // content: `✓ Solved Huntbot captcha:\n\`\`\`\n${password}\n\`\`\`\nAverage confidence: ${(avgConfidence * 100).toFixed(2)}%\nInference time: ${result.inferenceTime?.toFixed(2)}ms`,
                content: JSON.stringify({
                    result: password,
                    avgConfidence: (avgConfidence * 100).toFixed(2) + "%",
                    time: result.inferenceTime?.toFixed(2)
                }, null, 2),
            });
        } catch (error) {
            return interaction.editReply({
                content: `Failed to solve Huntbot captcha:\n\`\`\`${String(error)}\`\`\``,
            });
        }
    }

    /**
     * Validate URL is from allowed Discord CDN domains
     */
    private isValidDiscordUrl(urlString: string): boolean {
        try {
            const url = new URL(urlString);

            // Only allow HTTPS
            if (url.protocol !== "https:") {
                return false;
            }

            // Check against allowed domains
            return ALLOWED_DOMAINS.some(domain =>
                url.hostname === domain || url.hostname.endsWith(`.${domain}`)
            );
        } catch {
            return false;
        }
    }

    /**
 * Verify file is a valid image by checking magic bytes
 */
    private async isValidImageBuffer(buffer: Buffer): Promise<{ valid: boolean; mimeType?: string }> {
        const fileType = await fileTypeFromBuffer(buffer);
        if (!fileType) {
            return { valid: false };
        }

        return {
            valid: ALLOWED_MIME_TYPES.includes(fileType.mime),
            mimeType: fileType.mime,
        }
    }

    /**
     * Safely download and validate image
     */
    private async downloadAndValidateImage(url: string): Promise<Buffer> {
        // Validate URL
        if (!this.isValidDiscordUrl(url)) {
            throw new Error("Invalid or untrusted URL. Only Discord CDN URLs are allowed.");
        }

        try {
            // Download with timeout and size limit
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);

            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/1.0)',
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Download failed: ${response.status} ${response.statusText}`);
            }

            // Check Content-Length header
            const contentLength = response.headers.get("content-length");
            if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
                throw new Error(`File too large: ${contentLength} bytes (max: ${MAX_FILE_SIZE} bytes)`);
            }

            // Check Content-Type header
            const contentType = response.headers.get("content-type");
            if (contentType && !ALLOWED_MIME_TYPES.includes(contentType)) {
                throw new Error(`Invalid content type: ${contentType}. Only images are allowed.`);
            }

            // Download in chunks to enforce size limit
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error("Unable to read response body");
            }

            const chunks: Uint8Array[] = [];
            let totalSize = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                totalSize += value.length;
                if (totalSize > MAX_FILE_SIZE) {
                    reader.cancel();
                    throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE} bytes`);
                }

                chunks.push(value);
            }

            // Combine chunks into buffer
            const buffer = Buffer.concat(chunks);

            // Verify file signature (magic bytes)
            const validation = await this.isValidImageBuffer(buffer);
            if (!validation.valid) {
                throw new Error("File is not a valid image (invalid file signature)");
            }

            return buffer;

        } catch (error) {
            if (error instanceof Error) {
                if (error.name === "AbortError") {
                    throw new Error("Download timed out");
                }
                throw error;
            }
            throw new Error("Failed to download image");
        }
    }
}