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
import type { Command } from '../commands.js';
import { logger } from '../util/log.js';
import { queryServer } from '../util/server.js';

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
      const msg = await sendMCStatus(address, port, channel, lastMessage);
      if(msg) lastMessage = msg;
    }, 10000);

    guildIntervals.set(serverKey, intervalId);

    logger.info(`Registered a Minecraft Server (${serverKey}) for status polling `);
    await interaction.reply({
      content: `✅ 서버 등록 완료: \`${serverKey}\` → ${channel}`,
      flags: MessageFlags.Ephemeral
    });
  }
};

/**
 * 마인크래프트 서버로 직접 UDP 쿼리 요청을 보내서 서버 상태를 받아온다.
 * @param address 싱태를 확인할 마인크래프트 서버 주소
 * @param port 마인크래프트 서버가 열린 포트
 * @param channel 서버 상태를 올릴 디스코드 채널
 * @param lastMessage 이전에 올린 서버상태 메시지, null일 경우 메시지를 새로 보냄
 * @returns 서버상태를 올린 메시지 객체
 */
async function sendMCStatus(
  address: string, port:number,
  channel: TextChannel,
  lastMessage: Message | null
) : Promise<Message | undefined> {
  try {
    const sessionId = Math.floor(Math.random() * 0xffffffff);
    const response = await queryServer(address, port, sessionId);
    const serverOnline = response.online;

    const embed = new EmbedBuilder()
    if(serverOnline) {
      const max = response.maxPlayers;
      const online = response.numPlayers;
      const players = response.players!;

      embed
        .setTitle(`🎮 ${address}:${port} 상태`)
        .addFields(
          { name: '서버 상태', value:':green_circle: online' },
          { name: '접속자 수', value: `${online}/${max}`, inline: true },
          { name: '플레이어 목록', value: players.length ? players.join('\n') : '없음' }
        )
        .setTimestamp();
    } else {
      embed
        .setTitle(`🎮 ${address}:${port} 상태`)
        .addFields(
          { name: '서버 상태', value:':red_circle: offline' },
        )
        .setTimestamp();
    }

    
    if (!lastMessage) {
      const newMsg = await channel.send({ embeds: [embed] });
      logger.info(`Successfully sent Minecraft server (${address}:${port}) status`);
      if(!serverOnline) logger.warn(`Minecraft server (${address}:${port}) seems to be offline. Please check if your server address is correct!`)
      return newMsg;
    } else {
      const editedMsg = await lastMessage.edit({ embeds: [embed] });
      logger.info(`Successfully updated Minecraft server (${address}:${port}) status`);
      return editedMsg;
    }
  } catch (error) {
    logger.error(`UDP query request to ${address}:${port} failed: ${error.message}`);
    return undefined;
  }
}