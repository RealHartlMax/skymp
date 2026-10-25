export interface RemoteAuthGameData {
  session: string;
  masterApiId: number;
  discordUsername: string | null;
  discordDiscriminator: string | null;
  discordAvatar: string | null;
}

export interface LocalAuthGameData {
  profileId: number;
}

export interface AuthGameData {
  steamSession?: string;
  remote?: RemoteAuthGameData;
  local?: LocalAuthGameData;
}

export const authGameDataStorageKey = 'authGameData';
