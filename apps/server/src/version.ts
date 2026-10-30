import { execFileSync } from 'node:child_process';

/** Commit en cours d'exécution (« inconnue » hors d'un dépôt git), pour vérifier un déploiement. */
export function serverVersion(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'inconnue';
  }
}
