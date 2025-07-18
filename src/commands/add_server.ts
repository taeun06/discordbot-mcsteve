import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ChannelType,
  TextChannel,
} from 'discord.js';

import type { JavaStatusResponse } from 'node-mcstatus';
const mcs = require('node-mcstatus') as {
  statusJava: (
    addr: string,
    port?: number,
    opts?: { query?: boolean; timeout?: number }
  ) => Promise<JavaStatusResponse>;
};

export default {
  data: new SlashCommandBuilder()
    .setName('add_server')
    .setDescription('상태를 표시할 마인크래프트 서버를 등록합니다')
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
    .addChannelOption(opt =>
      opt.setName('channel')
         .setDescription('상태를 표시할 채널')
         .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement
        )
         .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  permissions: PermissionFlagsBits.ManageGuild,

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client;
    const guildId = interaction.guildId!;
    const address = interaction.options.getString('address', true);
    const port    = interaction.options.getInteger('port', true);
    const channel = interaction.options.getChannel('channel', true) as TextChannel;
    const serverKey = `${address}:${port}`;

    const guildMap = client.serverIntervals.get(guildId)!;

    if (guildMap.has(serverKey)) {
      clearInterval(guildMap.get(serverKey)!);
    }

    let lastMessage: import('discord.js').Message | null = null;
    const intervalId = setInterval(async () => {
      try {
        const result = await mcs.statusJava(address, port, { query: true }) as NonNullable<typeof result>;

        const online  = result?.players.online;
        const max     = result?.players.max;
        const players = result?.players.sample?.map(p => p.name) || [];

        const embed = new EmbedBuilder()
          .setTitle(`🎮 ${serverKey} 상태`)
          .addFields(
            { name: '접속자 수',     value: `${online}/${max}`, inline: true },
            { name: '플레이어 목록', value: players.length ? players.join('\n') : '없음' }
          )
          .setTimestamp();

        if (!lastMessage) {
          lastMessage = await channel.send({ embeds: [embed] });
        } else {
          lastMessage = await lastMessage.edit({ embeds: [embed] });
        }
      } catch (error) {
        console.error('mcstatus.io 에러:', error);
      }
    }, 10000);

    guildMap.set(serverKey, intervalId);

    await interaction.reply({
      content: `✅ 서버 등록 완료: \`${serverKey}\` → ${channel}`,
      flags: MessageFlags.Ephemeral
    });
  }
};
