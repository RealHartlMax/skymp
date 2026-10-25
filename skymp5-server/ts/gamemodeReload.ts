import * as fs from 'fs';

// Keep watching a missing/deployed gamemode without clearing the last loaded one.
export function createGamemodeReloader(filename: string, load: () => void, report: (error: unknown) => void): () => boolean {
  let missingReported = false;
  const missing = () => {
    if (!missingReported) report('[Gamemode] File is unavailable: ' + filename + '. Restore the existing gamemode or correct gamemodePath in the server configuration. Waiting for the file; the last loaded gamemode is retained.');
    missingReported = true;
    return false;
  };
  return () => {
    try {
      fs.statSync(filename);
      load();
      missingReported = false;
      return true;
    } catch (error) {
      const fileError = error as NodeJS.ErrnoException;
      if ((fileError.code === 'ENOENT' || fileError.code === 'ENOTDIR') && fileError.path === filename) return missing();
      report(error);
      return false;
    }
  };
}
