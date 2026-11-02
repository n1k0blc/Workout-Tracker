/**
 * Read-only pre-migration check for #221 (input validation). Run it against the target
 * database -- for production that is the Raspberry Pi database, reached through the SSH
 * tunnel like the other data scripts -- *before* applying
 * `20261101120000_normalize_input_rules_data` and *before* deploying the server rules.
 *
 * Editing a workout resends its whole tree, so any old row that breaks a new rule would make
 * that workout impossible to save. This reports, per row, everything that does: every limit in
 * the spec's table (names, ranges, array sizes, EAN check digits), warm-up sets carrying RIR,
 * users with more than one active Zyklus, and e-mails that collide case-insensitively.
 *
 * The migration corrects what is safe on its own (warm-up RIR becomes null, e-mails are
 * lowercased, names are trimmed) and the report lists those rows separately. Everything else
 * is fixed by hand first. An e-mail collision, or two templates of one user that collide once
 * trimmed, makes the migration abort with a message; the report names the rows beforehand.
 *
 * Writes nothing (only `findMany` is ever called). Exits 0 when nothing needs doing by hand,
 * 1 when something does.
 *
 *   DATABASE_URL=... npm run check:input-rules
 */
import { createPrismaClient } from '../prisma/create-prisma-client';
import { checkInputRules, formatReport } from '../src/common/validation/input-rules-check';

const prisma = createPrismaClient();

async function main() {
  const { text, blocking } = formatReport(await checkInputRules(prisma));
  console.log(text);
  if (blocking) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
