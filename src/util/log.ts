import { getTimestamp } from "./time.js";

enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

const colors = {
  reset: '\x1b[0m',
  info: '\x1b[36m',   // 청록색
  warn: '\x1b[33m',   // 노란색
  error: '\x1b[31m',  // 빨간색
};

export const logger = {
  info: (...messages: any[]) => {
    console.log(`${colors.info}${getTimestamp()} [${LogLevel.INFO}]${colors.reset}`, ...messages);
  },
  warn: (...messages: any[]) => {
    console.warn(`${colors.warn}${getTimestamp()} [${LogLevel.WARN}]${colors.reset}`, ...messages);
  },
  error: (...messages: any[]) => {
    console.error(`${colors.error}${getTimestamp()} [${LogLevel.ERROR}]${colors.reset}`, ...messages);
  },
};