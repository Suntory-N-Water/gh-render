const loggerName = 'gh-render';

/**
 * Log function that accepts either a message or an object with optional message
 */
type LogFn = {
  (msg: string): void;
  (obj: Record<string, unknown>, msg?: string): void;
};

/**
 * Logger interface compatible with Pino API
 */
type AppLogger = {
  info: LogFn;
  error: LogFn;
  warn: LogFn;
  debug: LogFn;
  trace: LogFn;
  fatal: LogFn;
  child: (bindings: Record<string, unknown>) => AppLogger;
};

/**
 * Log level type
 */
type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Log level ordering for filtering
 */
const logLevelOrder: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

/**
 * Returns order value for log level comparison
 */
function getLevelOrder(level: string): number {
  return logLevelOrder[level as LogLevel] ?? 2;
}

let coreLogger: AppLogger | undefined;

/**
 * Returns the shared application logger instance for emitting structured logs.
 */
export function getLogger(context?: string): AppLogger {
  if (!coreLogger) {
    coreLogger = createCoreLogger();
  }

  if (!context) {
    return coreLogger;
  }

  return coreLogger.child({ loggerContext: `-${context}-` });
}

/**
 * Creates a logger instance with specified configuration
 */
function createLogger(config: {
  name: string;
  level: string;
  bindings?: Record<string, unknown>;
}): AppLogger {
  const levelOrder = getLevelOrder(config.level);

  function log(
    level: LogLevel,
    first: string | Record<string, unknown>,
    second?: string,
  ): void {
    if (getLevelOrder(level) < levelOrder) {
      return;
    }

    const obj = typeof first === 'object' && first !== null ? first : {};
    const msg = typeof first === 'string' ? first : second;

    // Chrome拡張機能では常にPretty形式で出力
    const output = formatPretty(level, msg, {
      ...config.bindings,
      ...obj,
    });
    const consoleFn =
      level === 'error' || level === 'fatal' ? console.error : console.log;
    consoleFn(output);
  }

  const info = ((first, second) => log('info', first, second)) as LogFn;
  const error = ((first, second) => log('error', first, second)) as LogFn;
  const warn = ((first, second) => log('warn', first, second)) as LogFn;
  const debug = ((first, second) => log('debug', first, second)) as LogFn;
  const trace = ((first, second) => log('trace', first, second)) as LogFn;
  const fatal = ((first, second) => log('fatal', first, second)) as LogFn;

  return {
    info,
    error,
    warn,
    debug,
    trace,
    fatal,
    child: (bindings: Record<string, unknown>) =>
      createLogger({
        ...config,
        bindings: { ...config.bindings, ...bindings },
      }),
  };
}

/**
 * Formats log output in pretty format for human readability
 */
function formatPretty(
  level: LogLevel,
  msg: unknown,
  metadata: Record<string, unknown>,
): string {
  const { loggerContext, ...rest } = metadata;

  const formattedLevel = formatLevel(level);
  const contextValue = formatContextValue(loggerContext);
  const timestamp = formatTimestamp(new Date().toISOString());
  const message =
    typeof msg === 'string'
      ? msg
      : msg !== undefined
        ? JSON.stringify(msg)
        : '';

  const segments = [formattedLevel];
  if (contextValue) {
    segments.push(contextValue);
  }
  segments.push(timestamp);
  if (message) {
    segments.push(message);
  }

  const metadataStr =
    Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';

  return `${segments.join(', ')}${metadataStr}`;
}

function createCoreLogger(): AppLogger {
  return createLogger({
    name: loggerName,
    level: resolveLogLevel(),
  });
}

function formatContextValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

function formatLevel(level: string): string {
  return level.toUpperCase();
}

function formatTimestamp(iso: string): string {
  const [datePart] = iso.split('Z');
  return datePart?.split('.')[0] ?? iso;
}

/**
 * Resolves the current log level.
 *
 * Note: In a Chrome Extension environment, strict environment variables are not available.
 * This checks `globalThis.LOG_LEVEL` which can be set during build time (DefinePlugin)
 * or manually in the console for debugging.
 * Default is 'info'.
 */
function resolveLogLevel(): string {
  const globalContext = globalThis as {
    LOG_LEVEL?: string;
  };

  return typeof globalContext.LOG_LEVEL === 'string' &&
    globalContext.LOG_LEVEL.length > 0
    ? globalContext.LOG_LEVEL
    : 'info';
}
