import { SapphireClient } from "@sapphire/framework";
import { GatewayIntentBits } from "discord.js";
import { container } from "@/container/container.js";
import { TOKENS } from "@/container/tokens.js";
import { getRootData } from "@sapphire/pieces";
import { join } from "path";

import { LoggerService } from "@/services/logger.service.js";
import { HuntbotModelService } from "@/services/huntbot/index.js";


export class BotClient extends SapphireClient {
    constructor() {
        const userDir = join(getRootData().root, "src");
        console.log("[DEBUG] getRootData().root:", getRootData().root);
        console.log("[DEBUG] baseUserDirectory:", userDir);

        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ],
            baseUserDirectory: userDir,
            caseInsensitiveCommands: true,
            caseInsensitivePrefixes: true,
            defaultPrefix: "!",
            loadMessageCommandListeners: true,
        });
    }

    async initContainer() {
        container.register(TOKENS.Logger, new LoggerService());
        container.register(TOKENS.DB, {}); // Placeholder for DB instance
        container.register(TOKENS.UserService, {}); // Placeholder for UserService instance
        container.register(TOKENS.HuntbotModel, HuntbotModelService.getInstance());

        container.resolve<LoggerService>(TOKENS.Logger).debug("Container initialized with services.");
    }

    async start() {
        await this.initContainer();
        const logger = container.resolve<LoggerService>(TOKENS.Logger);

        try {
            logger.info("Attempting to login to Discord...");
            await this.login(process.env.BOT_TOKEN!);
        } catch (error) {
            logger.error("Failed to login to Discord:");
            logger.error(error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    }
}