const PREFIX = "[AethoriaBot]";

function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info(message: string, ...args: unknown[]): void {
    console.log(`${timestamp()} ${PREFIX} INFO: ${message}`, ...args);
  },

  warn(message: string, ...args: unknown[]): void {
    console.warn(`${timestamp()} ${PREFIX} WARN: ${message}`, ...args);
  },

  error(message: string, ...args: unknown[]): void {
    console.error(`${timestamp()} ${PREFIX} ERROR: ${message}`, ...args);
  },

  debug(message: string, ...args: unknown[]): void {
    if (process.env.DEBUG) {
      console.debug(`${timestamp()} ${PREFIX} DEBUG: ${message}`, ...args);
    }
  },
};
