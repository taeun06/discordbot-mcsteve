import dgram from 'dgram';
import { logger } from './log.js';

interface QueryResult {
  online: boolean,
  MOTD?: string;
  gameType?: string;
  gameID?: string;
  version?: string;
  plugins?: string;
  map?: string;
  numPlayers?: number;
  maxPlayers?: number;
  hostPort?: number;
  hostIP?: string;
  players?: string[];
}

/**
 * Send a UDP Query (protocol) to a Minecraft server and parse the response.
 * @param host server address
 * @param port server query port
 * @param sessionId arbitrary session identifier
 * @param timeout how long to wait (ms) before treating as offline
 */
export async function queryServer(
  host: string,
  port: number,
  sessionId: number,
  timeout: number = 5000
): Promise<QueryResult> {
  const socket = dgram.createSocket('udp4');

  return new Promise((resolve, reject) => {
    // Timeout to detect offline server
    const timer = setTimeout(() => {
      socket.close();
      resolve({ online: false });
    }, timeout);

    const cleanupAndReject = (err: Error) => {
      clearTimeout(timer);
      socket.close();
      reject(err);
    };
    const cleanupAndResolve = (res: QueryResult) => {
      clearTimeout(timer);
      socket.close();
      resolve(res);
    };

    socket.once('error', err => cleanupAndReject(err));

    // 1) Handshake: 0xFE,0xFD,0x09 + sessionId (big-endian)
    const handshake = Buffer.alloc(3 + 4);
    handshake.writeUInt8(0xFE, 0);
    handshake.writeUInt8(0xFD, 1);
    handshake.writeUInt8(0x09, 2);
    handshake.writeUInt32BE(sessionId, 3);
    socket.send(handshake, port, host, err => {
      if (err) return cleanupAndReject(err);
    });

    // receive handshake response
    socket.once('message', msg => {
      // msg: [type(1), sessionId(4), challenge ASCII + null]
      const raw = msg.toString('ascii', 5);
      // Extract digits only to handle stray control chars
      const digits = raw.replace(/\D+/g, '');
      if (!digits) {
        return cleanupAndReject(new Error('Invalid challenge token (no digits): ' + JSON.stringify(raw)));
      }
      const token = parseInt(digits, 10);
      if (isNaN(token)) {
        return cleanupAndReject(new Error('Invalid challenge token after digit filter: ' + digits));
      }

      // 2) Full query: 0xFE,0xFD,0x00 + sessionId(4) + token(4) + 4-byte padding
      const query = Buffer.alloc(3 + 4 + 4 + 4);
      let offset = 0;
      query.writeUInt8(0xFE, offset++);
      query.writeUInt8(0xFD, offset++);
      query.writeUInt8(0x00, offset++);
      query.writeUInt32BE(sessionId, offset); offset += 4;
      query.writeUInt32BE(token, offset);     offset += 4;

      socket.send(query, port, host, err2 => {
        if (err2) return cleanupAndReject(err2);
      });

      // receive full query response
      socket.once('message', resp => {
        // skip first 9 bytes: type(1), sessionId(4), padding(4)
        const payload = resp.subarray(16);

        // 5) 0x01 바이트 기준으로 서버 정보 파트와 플레이어 리스트 파트로 분리
        const sepIndex = payload.indexOf(0x01);
        if (sepIndex < 0) throw new Error('Malformed full stat response');
        const serverBuf = payload.subarray(0, sepIndex);
        const playerBuf = payload.subarray(sepIndex + 1);

        // 6) 서버 정보 파싱 (0x00 구분자로 split)
        const parts = serverBuf.toString('ascii').split('\0');
        const info: Record<string, string> = {};
        for (let i = 0; i + 1 < parts.length; i += 2) {
          const key = parts[i];
          const val = parts[i + 1];
          if (key) info[key] = val;
        }

        // 7) 플레이어 리스트 파싱
        //    앞의 "player_" + 0x00 0x00 (총 9바이트) 건너뛰고,
        //    남은 데이터를 0x00으로 split
        const playersSection = playerBuf.subarray(9).toString('ascii').split('\0');
        const players = playersSection.filter((n) => n.length > 0);

        const result: QueryResult = {
          online:     true,
          MOTD: info['hostname'] || '',
          gameType: info['gametype'] || '',
          gameID:   info['game_id']  || '',
          version:  info['version']  || '',
          plugins:  info['plugins']  || '',
          map:      info['map']      || '',
          numPlayers: parseInt(info['numplayers'] || '0', 10),
          maxPlayers: parseInt(info['maxplayers'] || '0', 10),
          hostPort:   parseInt(info['hostport']   || '0', 10),
          hostIP:     info['hostip'] || '',
          players,
        };

        logger.debug(result);
        cleanupAndResolve(result);
      });
    });
  });
}