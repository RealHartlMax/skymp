export interface ServerEntryDto {
  id: string;
  name: string;
  ip: string;
  port: number;
  players: number;
  maxPlayers: number;
  ping: number | null;
  version: string;
  description?: string;
  tags?: string[];
  online: boolean;
  passwordProtected?: boolean;
}

const removeTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const toServersUrl = (apiEndpoint: string): string => {
  const trimmed = apiEndpoint.trim();
  if (!trimmed) return '/api/servers';
  if (trimmed.startsWith('/')) return `${removeTrailingSlash(trimmed)}/api/servers`;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return `${removeTrailingSlash(trimmed)}/api/servers`;
  }
  return `http://${removeTrailingSlash(trimmed)}/api/servers`;
};

export const fetchServerList = async (apiEndpoint: string): Promise<ServerEntryDto[]> => {
  const url = toServersUrl(apiEndpoint);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`server-list-api:${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('server-list-api:invalid-payload');
  }

  return data as ServerEntryDto[];
};
