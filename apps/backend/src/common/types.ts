// Re-exported (not redeclared) so this is structurally identical to what Prisma returns --
// a locally-declared enum with the same members is a distinct nominal type in TypeScript
// and would reject Prisma query results at compile time.
export { SetType } from '../../generated/prisma';
