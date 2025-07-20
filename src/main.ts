import 'dotenv/config';
import {
  GatewayIntentBits, REST,
  Client, Routes,
} from 'discord.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { commands, loadCommands, commandProcess } from './commands.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

declare module 'discord.js' {
  interface Client {
    serverIntervals: Map<string, Map<string, NodeJS.Timeout>>;
    //TODO: 추후에 이 확장된 필드도 제거
  }
}

const client = new Client({ intents: [ GatewayIntentBits.Guilds ] });
client.serverIntervals = new Map();
await loadCommands(join(__dirname, 'commands'));

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN!);
const CLIENT_ID = process.env.CLIENT_ID!;

client.once('ready', async () => {
  console.log(`MCBOT-STEVE v0.0.1 Ready - Logged in as ${client.user?.tag}`);
  const commandData = commands.map(cmd => cmd.data.toJSON());
  for (const guild of client.guilds.cache.values()) {
    client.serverIntervals.set(guild.id, new Map());
    try {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, guild.id),
        { body: commandData }
      );
      console.log(`Registered commands for Server ${guild.name} (${guild.id})`);
    } catch (err) {
      console.error(`Error registering commands for Server ${guild.name} (${guild.id}):`, err);
    }
  }
});

client.on('guildCreate', async guild => {
  console.log(`Joined New Server: ${guild.name} (${guild.id})`);
  client.serverIntervals.set(guild.id, new Map());
  const commandData = commands.map(cmd => cmd.data.toJSON());
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, guild.id),
      { body: commandData }
    );
    console.log(`Registered commands for Server ${guild.name} (${guild.id})`);
  } catch (err) {
    console.error(`Error occurred while registering to Server ${guild.name} (${guild.id}):`, err);
  }
});

client.on('guildDelete', guild => {
  const guildMap = client.serverIntervals.get(guild.id);
  if (guildMap) {
    for (const intervalId of guildMap.values()) clearInterval(intervalId);
    client.serverIntervals.delete(guild.id);
    console.log(`Cleared all intervals for Server ${guild.name} (${guild.id})`);
  }
});

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    commandProcess(interaction);
  } else if (interaction.isButton()) {
    // TODO: 버튼 처리
  } else if (interaction.isModalSubmit()) {
    // TODO: 모달 제출 처리
  } else if (interaction.isStringSelectMenu()) {
    // TODO: 셀렉트 메뉴 처리
  } // 다른 Interaction 타입들도 처리...
});

client.login(process.env.BOT_TOKEN);