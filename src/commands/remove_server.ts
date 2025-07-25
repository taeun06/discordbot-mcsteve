import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ChannelType,
  TextChannel,
} from 'discord.js';
import type { Command } from '../commands.js';
import { logger } from '../util/log.js';

export const cmd : Command = {
  data: new SlashCommandBuilder()
    .setName('remove_server')
    .setDescription('상태표시 등록한 서버를 등록 해제합니다.')
    .addStringOption(opt =>
      opt.setName('address')
         .setDescription('서버의 도메인 또는 IP')
         .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('port')
         .setDescription('서버 포트 번호')
         .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  
  permissions: PermissionFlagsBits.ManageGuild,

  async execute(interaction: ChatInputCommandInteraction){
    const client = interaction.client;
    const guildID = interaction.guild?.id!;
    const address = interaction.options.getString('address', true);
    const port    = interaction.options.getInteger('port', true);

    const guildMap = client.serverIntervals.get(guildID)!;
    const serverKey : string = `${address}:${port}`;

    if (!guildMap.has(serverKey)) {
      logger.info(`Failed to deregister a Minecraft server (${serverKey}) for regular status polling: No such registered server`);
      await interaction.reply({
        content: `❌ 등록된 서버가 없습니다: \`${serverKey}\``,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    clearInterval(client.serverIntervals.get(guildID)?.get(serverKey));
    client.serverIntervals.get(guildID)?.delete(serverKey);
    logger.info(`Deregistered a Minecraft server (${serverKey}) for regular status polling`);
    await interaction.reply({
      content: `🗑️ 서버 제거 완료: \`${serverKey}\``,
      flags: MessageFlags.Ephemeral
    });
  }
}