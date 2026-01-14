import {
    Listener,
    type ChatInputCommandSuccessPayload,
    Events
} from "@sapphire/framework";

import { container } from "@/container/container.js";
import { TOKENS } from "@/container/tokens.js";
import { LoggerService } from "@/services/logger.service.js";
import {
    ChannelType,
    EmbedBuilder,
    WebhookClient,
    type ChatInputCommandInteraction,
    type Message
} from "discord.js";

const WEBHOOK_URL = process.env.COMMAND_LOG_WEBHOOK_URL;
const MAX_FIELD_LENGTH = 1024;

export class CommandLogger extends Listener {
    private webhookClient: WebhookClient | null = null;

    public constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
            ...options,
            event: Events.ChatInputCommandSuccess
        });

        // Initialize webhook if URL is provided
        if (WEBHOOK_URL) {
            try {
                this.webhookClient = new WebhookClient({ url: WEBHOOK_URL });
            } catch (error) {
                console.error("Failed to initialize command log webhook:", error);
            }
        }
    }

    public async run(payload: ChatInputCommandSuccessPayload) {
        const logger = container.resolve<LoggerService>(TOKENS.Logger);
        const { interaction, command, duration, result } = payload;

        try {
            // Small delay to ensure reply is fully sent
            await new Promise(resolve => setTimeout(resolve, 100));

            const responseData = await this.extractResponseData(interaction, result);
            await this.logToWebhook(interaction, command.name, duration, responseData);

            logger.debug(`Command /${command.name} executed by ${interaction.user.username} in ${duration.toFixed(2)}ms`);
        } catch (error) {
            logger.error(`Failed to log command ${command.name}:`, error);
        }
    }

    private async extractResponseData(interaction: ChatInputCommandInteraction, result: unknown): Promise<string> {
        try {
            // Try to fetch the actual reply
            if (interaction.replied || interaction.deferred) {
                const reply = await interaction.fetchReply();
                return this.formatReplyMessage(reply);
            }
        } catch (error) {
            // Fallback to result if fetch fails
            if (result !== undefined && result !== null) {
                return this.formatResult(result);
            }
        }

        return "*(No response data)*";
    }

    private formatReplyMessage(reply: Message): string {
        // Extract content from the reply message
        if (reply.content) {
            return this.truncate(reply.content, MAX_FIELD_LENGTH);
        }

        // Extract from embeds if no content
        if (reply.embeds.length > 0) {
            const embed = reply.embeds[0];
            if (!embed) return "*(Empty response)*";

            const parts: string[] = [];

            if (embed.title) parts.push(`**${embed.title}**`);
            if (embed.description) parts.push(embed.description);

            if (embed.fields && embed.fields.length > 0) {
                embed.fields.forEach(field => {
                    parts.push(`**${field.name}:** ${field.value}`);
                });
            }

            return this.truncate(parts.join("\n"), MAX_FIELD_LENGTH);
        }

        // Check for attachments
        if (reply.attachments.size > 0) {
            const attachments = Array.from(reply.attachments.values());
            return `[${attachments.length} attachment(s)]`;
        }

        return "*(Empty response)*";
    }

    private formatResult(result: unknown): string {
        if (typeof result === 'string') {
            return this.truncate(result, MAX_FIELD_LENGTH);
        }

        if (typeof result === 'object' && result !== null) {
            try {
                const json = JSON.stringify(result, null, 2);
                return this.truncate(json, MAX_FIELD_LENGTH - 20, "```json\n", "\n```");
            } catch {
                return String(result);
            }
        }

        return String(result);
    }

    private async logToWebhook(
        interaction: ChatInputCommandInteraction,
        commandName: string,
        duration: number,
        responseData: string
    ) {
        if (!this.webhookClient) return;

        try {
            const user = interaction.user;
            const channel = interaction.channel;
            const guild = interaction.guild;

            const channelName = channel?.type === ChannelType.DM
                ? "Direct Message"
                : channel
                    ? `<#${channel.id}>`
                    : "Unknown Channel";

            const isSuccess = interaction.replied || interaction.deferred;

            const embed = new EmbedBuilder()
                .setTitle(`${isSuccess ? "✅" : "❌"} Command: /${commandName}`)
                .setColor(isSuccess ? 0x00FF00 : 0xFF0000)
                .addFields(
                    {
                        name: "👤 User",
                        value: `${user.username}\n\`${user.id}\``,
                        inline: true
                    },
                    {
                        name: "📍 Channel",
                        value: channelName,
                        inline: true
                    },
                    {
                        name: "🏰 Guild",
                        value: guild ? `${guild.name}\n\`${guild.id}\`` : "Direct Message",
                        inline: true
                    },
                    {
                        name: "⚙️ Arguments",
                        value: `\`\`\`${interaction.toString()}\`\`\``,
                        inline: false
                    },
                    {
                        name: "🫧 Response",
                        value: responseData,
                        inline: false
                    }
                )
                .setTimestamp(new Date())
                .setFooter({
                    text: `Execution Time: ${duration.toFixed(2)}ms`,
                    iconURL: user.displayAvatarURL()
                });

            await this.webhookClient.send({
                embeds: [embed],
                username: "Command Logger",
                avatarURL: "https://i.imgur.com/MO5TPzf.png"
            });

        } catch (error) {
            const logger = container.resolve<LoggerService>(TOKENS.Logger);
            logger.error("Failed to send command log to webhook:", error);
        }
    }

    private truncate(text: string, maxLength: number, prefix = "```", suffix = "```"): string {
        const availableLength = maxLength - prefix.length - suffix.length;

        if (text.length <= availableLength) {
            return prefix + text + suffix;
        }

        return prefix + text.substring(0, availableLength - 3) + "..." + suffix;
    }
}
