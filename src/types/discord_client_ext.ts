import { ChatInputCommandInteraction, Collection } from 'discord.js';

export interface Command {
  data: { name: string; toJSON(): unknown };
  permissions?: bigint;
  requiredRoles?: string[];
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

declare module 'discord.js' {
  interface Client {
    serverIntervals: Map<string, Map<string, NodeJS.Timeout>>;
    commands: Collection<string, Command>;
  }
}