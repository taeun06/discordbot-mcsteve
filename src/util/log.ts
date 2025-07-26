import { getTimestamp } from "./time.js";

// logger.ts
enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

// 콘솔 색상 ANSI 코드
const colors = {
  reset: '\x1b[0m',
  debug: '\x1b[90m',  // 회색
  info: '\x1b[36m',   // 청록색
  warn: '\x1b[33m',   // 노란색
  error: '\x1b[31m',  // 빨간색
};

// NODE_ENV에 따른 최소 로그 레벨 설정
// development: DEBUG 이상 모두 출력
// production: INFO 이상 출력
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

const currentLevel = process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO;

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel];
}

export const logger = {
  debug: (...messages: any[]) => {
    if (shouldLog(LogLevel.DEBUG)) {
      console.debug(`${colors.debug}${getTimestamp()} [${LogLevel.DEBUG}]${colors.reset}`, ...messages);
    }
  },
  info: (...messages: any[]) => {
    if (shouldLog(LogLevel.INFO)) {
      console.log(`${colors.info}${getTimestamp()} [${LogLevel.INFO}]${colors.reset}`, ...messages);
    }
  },
  warn: (...messages: any[]) => {
    if (shouldLog(LogLevel.WARN)) {
      console.warn(`${colors.warn}${getTimestamp()} [${LogLevel.WARN}]${colors.reset}`, ...messages);
    }
  },
  error: (...messages: any[]) => {
    if (shouldLog(LogLevel.ERROR)) {
      console.error(`${colors.error}${getTimestamp()} [${LogLevel.ERROR}]${colors.reset}`, ...messages);
    }
  },
};