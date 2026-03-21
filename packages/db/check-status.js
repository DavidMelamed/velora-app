const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const total = await p.attorney.count();
  const reviews = await p.attorneyReview.count();
  const byState = await p.attorney.groupBy({ by: ['stateCode'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } });
  const byCity = await p.attorney.groupBy({ by: ['city'], _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 15 });
  console.log('Attorneys:', total, '| Reviews:', reviews);
  console.log('\nBy state:');
  for (const s of byState) console.log('  ' + s.stateCode + ': ' + s._count.id);
  console.log('\nTop cities:');
  for (const c of byCity) console.log('  ' + c.city + ': ' + c._count.id);
  await p.$disconnect();
}
main();
