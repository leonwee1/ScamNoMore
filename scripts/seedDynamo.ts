/**
 * Seeds the ScamNoMore DynamoDB table with the 5000-row dataset.
 *
 * Prerequisites (all free-tier):
 *   1. AWS account + credentials in your environment (aws configure / env vars).
 *   2. A DynamoDB table (on-demand capacity) with primary key `id` (String).
 *      Create it via the console or:
 *        aws dynamodb create-table \
 *          --table-name ScamNoMoreScams \
 *          --attribute-definitions AttributeName=id,AttributeType=S \
 *          --key-schema AttributeName=id,KeyType=HASH \
 *          --billing-mode PAY_PER_REQUEST \
 *          --region ap-southeast-1
 *
 * Run: AWS_REGION=ap-southeast-1 npm run seed
 */
import records from '../src/data/scams.json';
import { batchWrite } from '../src/services/dynamo';
import type { ScamRecord } from '../src/data/types';

async function main() {
  const region = process.env.AWS_REGION ?? 'ap-southeast-1';
  const table = process.env.DYNAMO_TABLE ?? 'ScamNoMoreScams';
  const all = records as ScamRecord[];

  console.log(`Seeding ${all.length} records into ${table} (${region})...`);
  const start = Date.now();
  await batchWrite({ region, table }, all);
  console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
