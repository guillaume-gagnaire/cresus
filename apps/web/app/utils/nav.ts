/** `/` exact, les autres sections avec leurs sous-pages (`/clients/new`, `/clients/:id`). */
export function isRouteActive(currentPath: string, to: string): boolean {
  return to === '/' ? currentPath === '/' : currentPath === to || currentPath.startsWith(`${to}/`);
}
