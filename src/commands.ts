import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { join } from 'path';
import { 
  Client, 
  GuildMember,
  APIInteractionGuildMember, 
  ChatInputCommandInteraction, 
  Collection,
} from 'discord.js';
import { logger } from './util/log.js';

export const commands : Collection<string, Command> = new Collection<string, Command>();

export interface Command {
  data: { name: string; toJSON(): unknown };
  permissions?: bigint;
  requiredRoles?: string[];
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export async function loadCommands(commandsPath: string) {
  const files = readdirSync(commandsPath)
    .filter(f => f.endsWith('.js') || f.endsWith('.ts'));
  for (const file of files) {
    const moduleUrl = pathToFileURL(join(commandsPath, file)).href;
    const commandModule = await import(moduleUrl);
    const command: Command =
      commandModule.default
      ?? commandModule.cmd
      ?? commandModule;
    commands.set(command.data.name, command);
  }
}
export async function commandProcess(interaction: ChatInputCommandInteraction) {
  const client : Client = interaction.client;
  const command : Command = commands.get(interaction.commandName) as NonNullable<typeof command>;
  if (!command) return;

  if (command.permissions && !interaction.memberPermissions?.has(command.permissions)) {
    console.warn(`Failed to execute a command: No permission (User ID: ${interaction.user.id})`);
    return interaction.reply({ content: '이 명령을 실행할 권한이 없습니다.', ephemeral: true });
  }

  if (command.requiredRoles) { //TODO : 권한 처리 로직은 이후에 다른 함수로 빼기?
    let member : GuildMember | APIInteractionGuildMember = interaction.member as NonNullable<typeof member>;
    if(!(member instanceof GuildMember)){
      member = await interaction.guild!.members.fetch(interaction.user.id);
    }
    if (!command.requiredRoles.some(role => member.roles.cache.some(r => r.name === role))) {
      console.warn(`Failed to execute a command: No role (User ID: ${interaction.user.id})`);
      return interaction.reply({ content: '이 명령을 실행할 수 있는 역할을 가지고 있지 않습니다.', ephemeral: true });
    }
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(err);
    if (!interaction.replied) {
      logger.error(`Unknown Error while processing a command: ${err.message}`);
      await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true });
    }
  }
}