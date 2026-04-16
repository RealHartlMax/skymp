const PING_GOOD = 80;
const PING_OK = 150;

export const pingClass = (ping: number | null): string => {
  if (ping === null) return 'server-list__ping--unknown';
  if (ping <= PING_GOOD) return 'server-list__ping--good';
  if (ping <= PING_OK) return 'server-list__ping--ok';
  return 'server-list__ping--bad';
};

export const pingLabel = (ping: number | null): string => {
  if (ping === null) return '–';
  return `${ping}ms`;
};

export const isValidPort = (port: number): boolean => {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
};
