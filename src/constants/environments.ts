/**
 * Environments every new project starts with. Production is protected from
 * the start, which is what stops editors from toggling flags there.
 */
export const DEFAULT_ENVIRONMENTS = [
  { name: 'Development', slug: 'development', protected: false },
  { name: 'Production', slug: 'production', protected: true },
] as const
