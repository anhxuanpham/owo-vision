import { Listener } from "@sapphire/framework";
import { TOKENS } from "@/container/tokens.js";
import { container } from "@/container/container.js";
import { LoggerService } from "@/services/logger.service.js";
import { ActivityType, Client, Events } from "discord.js";

export default class ReadyListener extends Listener {
    constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
            ...options,
            event: Events.ClientReady,
            once: true
        });
    }

    run(client: Client) {
        const logger = container.resolve<LoggerService>(TOKENS.Logger);
        logger.debug(`Loaded ${this.container.stores.get("commands").size} command(s).`);
        logger.debug(`Loaded ${this.container.stores.get("listeners").size} listener(s).`);

        // List loaded pieces for debugging
        for (const [name, piece] of this.container.stores.get('listeners').entries()) {
            logger.debug(`  - Listener: ${name} (${piece.constructor.name})`);
        }
        for (const [name, piece] of this.container.stores.get('commands').entries()) {
            logger.debug(`  - Command: ${name} (${piece.constructor.name})`);
        }

        logger.info("Ready! Logged in as", client.user?.username);
        logger.info(`Serving in ${client.guilds.cache.size} guild(s).`);

        // Set custom activity
        client.user?.setPresence({
            activities: [
                {
                    name: "ADOTF v4 - 20/07/2025",
                    type: ActivityType.Streaming,
                    url: "https://www.twitch.tv/kyouizumi",
                },
                {
                    name: `${client.guilds.cache.size} servers`,
                    type: ActivityType.Watching
                },
            ],
            status: "online"
        });
        logger.info("Activity status set successfully");

        client.on("debug", logger.debug.bind(logger));
        client.on("error", logger.error.bind(logger));
        client.on("warn", logger.warn.bind(logger));
    }
}