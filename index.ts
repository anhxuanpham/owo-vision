import "dotenv/config";
import { BotClient } from "@/bot.js";

const client = new BotClient();

client.start();