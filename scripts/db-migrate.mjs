// Applies db/migrations to DATABASE_URL (Neon). Usage: npm run db:migrate [-- --seed]
import { migrateNeon, seedSamples } from '../server/runtime.mjs';
import { neonQuery } from '../server/db.mjs';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL이 필요합니다. 예: vercel env pull .env.local 후 node --env-file=.env.local scripts/db-migrate.mjs'); process.exit(1); }
const ran = await migrateNeon(url);
console.log(ran.length ? `적용한 마이그레이션: ${ran.join(', ')}` : '새로 적용할 마이그레이션이 없습니다.');
if (process.argv.includes('--seed')) {
  const seeded = await seedSamples(await neonQuery(url));
  console.log(seeded ? `레이스 예시 앨범 ${seeded}개를 추가했습니다.` : '레이스 앨범이 이미 있어 예시를 추가하지 않았습니다.');
}
