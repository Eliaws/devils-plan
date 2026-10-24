// structuredClone est un standard du web, disponible dans Node et les navigateurs.
// TypeScript ne le déclare qu'avec les types DOM ou Node : on le déclare ici pour
// que le moteur reste indépendant de l'environnement.
declare global {
  function structuredClone<T>(value: T): T;
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}
