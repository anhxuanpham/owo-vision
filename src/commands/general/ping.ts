import { ApplicationCommandRegistry, Args, Command, type Awaitable, type ChatInputCommand, type MessageCommand } from "@sapphire/framework";
import { ChatInputCommandInteraction, Message, MessageFlags } from "discord.js";
import util from "node:util";


export default class PingCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "ping",
            description: "Replies with Pong!",
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName(this.name)
                .setDescription(this.description)
        );
    }

    async chatInputRun(interaction: ChatInputCommandInteraction) {
        const content = "Pong! 🏓\n> **WS Latency:** %dms \n> **API Latency:** %dms";
        const initial = await interaction.reply({ content: "Pinging...", withResponse: true, flags: MessageFlags.Ephemeral });

        return interaction.editReply(util.format(
            content,
            Math.round(this.container.client.ws.ping),
            initial.interaction.createdTimestamp - interaction.createdTimestamp
        ));
    }

    async messageRun(message: Message) {
        if (!message.channel.isSendable()) return;

        const content = "Pong! 🏓\n> **WS Latency:** %dms \n> **API Latency:** %dms";
        const msg = await message.channel.send({ content: "Pinging..." });

        return msg.edit(util.format(
            content,
            Math.round(this.container.client.ws.ping),
            msg.createdTimestamp - message.createdTimestamp
        ));
    }
}