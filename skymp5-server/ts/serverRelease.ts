export const DEFAULT_RELEASE_REPOSITORY = 'RealHartlMax/skymp';

export function releaseRepository(value: unknown): string {
  const repository = value === undefined || value === null || value === '' ? DEFAULT_RELEASE_REPOSITORY : value;
  if (typeof repository !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}\/[a-zA-Z0-9_.-]{1,100}$/.test(repository) || repository.includes('..')) {
    throw Error('Invalid releaseRepository; expected owner/repository');
  }
  return repository;
}

export const latestReleaseUrl = (value: unknown): string => `https://api.github.com/repos/${releaseRepository(value)}/releases/latest`;
