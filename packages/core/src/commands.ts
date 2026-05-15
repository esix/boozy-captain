export interface Command {
  id: string;
  title: string;
  run: (ctx?: unknown) => void | Promise<void>;
}

export class CommandRegistry {
  private readonly commands = new Map<string, Command>();

  register(cmd: Command): void {
    if (this.commands.has(cmd.id)) {
      throw new Error(`Command already registered: ${cmd.id}`);
    }
    this.commands.set(cmd.id, cmd);
  }

  list(): Command[] {
    return Array.from(this.commands.values());
  }

  async run(id: string, ctx?: unknown): Promise<void> {
    const cmd = this.commands.get(id);
    if (!cmd) throw new Error(`Unknown command: ${id}`);
    await cmd.run(ctx);
  }
}
