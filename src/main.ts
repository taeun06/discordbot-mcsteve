import 'dotenv/config';
import { readdirSync } from 'fs';
import { join } from 'path';
import { Command } from './types/discord_client_ext'
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Collection,
  MessageFlags,
  ChatInputCommandInteraction,
  Interaction,
  GuildMember
} from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.serverIntervals = new Map();
client.commands = new Collection<string, Command>();

const commandsPath = join(__dirname, 'commands');
for (const file of readdirSync(commandsPath).filter(f => f.endsWith('.js') || f.endsWith('.ts'))) {
  const commandModule = require(join(commandsPath, file));
  const command: Command = commandModule.default;
  client.commands.set(command.data.name, command);
}

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN!);
const CLIENT_ID = process.env.CLIENT_ID!;

client.once('ready', async () => {
  console.log(`MCBOT-STEVE v0.0.1 Ready - Logged in as ${client.user?.tag}`);
  const commandData = client.commands.map(cmd => cmd.data.toJSON());
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
  const commandData = client.commands.map(cmd => cmd.data.toJSON());
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
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

  if (command.permissions && !interaction.memberPermissions?.has(command.permissions)) {
    return interaction.reply({ content: '이 명령을 실행할 권한이 없습니다.', flags: MessageFlags.Ephemeral });
  }
  if (command.requiredRoles) {
    const member = interaction.member as GuildMember;
    if (!command.requiredRoles.some(role => member.roles.cache.some(r => r.name === role))) {
      return interaction.reply({ content: '이 명령을 실행할 수 있는 역할을 가지고 있지 않습니다.', flags: MessageFlags.Ephemeral });
    }
  }

    try {
      await command.execute(interaction as ChatInputCommandInteraction);
    } catch (err) {
      console.error(err);
      if (!interaction.replied) {
        await interaction.reply({ content: '오류가 발생했습니다.', flags: MessageFlags.Ephemeral });
      }
    }
  } else if (interaction.isButton()) {
    // TODO: 버튼 처리
  } else if (interaction.isModalSubmit()) {
    // TODO: 모달 제출 처리
  } else if (interaction.isStringSelectMenu()) {
    // TODO: 셀렉트 메뉴 처리
  } // 다른 Interaction 타입들도 처리...
});

client.login(process.env.BOT_TOKEN);