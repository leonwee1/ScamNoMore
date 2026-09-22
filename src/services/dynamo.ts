import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { ScamRecord } from '../data/types';

/**
 * DynamoDB access helpers (AWS SDK v3, on-demand billing = free-tier friendly).
 *
 * IMPORTANT: This module is imported ONLY from Node contexts (the seed script
 * and Lambda handlers), never from the Expo/React Native bundle. The app writes
 * reports through the API/Lambda, which calls putReport here so that user
 * reports land in the SAME table as the 5000 mockup rows.
 *
 * Table design:
 *   PK: id (String)  -- source URL or user-report id
 *   Attributes: dateReported, scamType, keywords (List), town, specificPlace,
 *               source, verified (Bool), year (Number)
 *   GSI (optional): scamType-index (PK scamType, SK dateReported)
 */
export interface DynamoDeps {
  region: string;
  table: string;
}

function getClient(region: string): DynamoDBDocumentClient {
  const base = new DynamoDBClient({ region });
  return DynamoDBDocumentClient.from(base);
}

export async function putRecord(deps: DynamoDeps, record: ScamRecord): Promise<void> {
  const doc = getClient(deps.region);
  await doc.send(new PutCommand({ TableName: deps.table, Item: record }));
}

/** Batch write up to 25 items per request (DynamoDB limit). */
export async function batchWrite(deps: DynamoDeps, records: ScamRecord[]): Promise<void> {
  const doc = getClient(deps.region);
  for (let i = 0; i < records.length; i += 25) {
    const chunk = records.slice(i, i + 25);
    await doc.send(
      new BatchWriteCommand({
        RequestItems: {
          [deps.table]: chunk.map((Item) => ({ PutRequest: { Item } })),
        },
      })
    );
  }
}

/** Persist a user incident report into the shared table. */
export async function putReport(deps: DynamoDeps, record: ScamRecord): Promise<void> {
  return putRecord(deps, record);
}
