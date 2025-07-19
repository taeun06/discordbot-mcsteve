import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ChannelType,
  TextChannel,
  Message,
} from 'discord.js';
import type { Command } from './commands';
import * as mcs from 'node-mcstatus';

export const cmd : Command = {
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

    const guildIntervals = client.serverIntervals.get(guildId)!;

    if (guildIntervals.has(serverKey)) {
      clearInterval(guildIntervals.get(serverKey)!);
    }

    let lastMessage: Message | null = null;
    const intervalId = setInterval(async () => {
      const msg = await serverStatus(address, port, channel, lastMessage);
      if(msg) lastMessage = msg;
      //TODO: 서버 연결 에러 났을 시 서버가 오프라인임도 알려주는 기능 추가
    }, 10000);

    guildIntervals.set(serverKey, intervalId);

    await interaction.reply({
      content: `✅ 서버 등록 완료: \`${serverKey}\` → ${channel}`,
      flags: MessageFlags.Ephemeral
    });
  }
};

async function serverStatus(
  address: string, port:number,
  channel: TextChannel,
  lastMessage: Message | null) : Promise<Message | undefined>{
  try {
    const result = await mcs.statusJava(address, port, { query: true }) as NonNullable<typeof result>;

    const online  = result?.players.online;
    const max     = result?.players.max;
    const players = result?.players.sample?.map(p => p.name) || [];

    const embed = new EmbedBuilder()
      .setTitle(`🎮 ${address}:${port} 상태`)
      .addFields(
        { name: '접속자 수',     value: `${online}/${max}`, inline: true },
        { name: '플레이어 목록', value: players.length ? players.join('\n') : '없음' }
      )
      .setTimestamp();

    if (!lastMessage) {
      return await channel.send({ embeds: [embed] });
    } else {
      return await lastMessage.edit({ embeds: [embed] });
    }
  } catch (error) {
    console.error('mcstatus.io 에러:', error);
    return undefined;
  }
}