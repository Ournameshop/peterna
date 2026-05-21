import 'server-only';

import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

type EnvKey =
  | 'R2_ACCOUNT_ID'
  | 'R2_ACCESS_KEY_ID'
  | 'R2_SECRET_ACCESS_KEY'
  | 'R2_BUCKET'
  | 'R2_PUBLIC_BASE_URL';

function requireEnv(key: EnvKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not set. Add it to .env (see .env.example).`);
  }
  return value;
}

let cachedClient: S3Client | undefined;
function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  const accountId = requireEnv('R2_ACCOUNT_ID');
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
  });
  return cachedClient;
}

export type UploadObjectInput = {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
};

/** Upload an object to the configured R2 bucket. */
export async function uploadObject(input: UploadObjectInput): Promise<void> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: requireEnv('R2_BUCKET'),
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );
}

/** Delete one or more objects from the configured R2 bucket. */
export async function deleteObjects(input: { keys: string[] }): Promise<void> {
  if (input.keys.length === 0) return;
  const client = getClient();
  await client.send(
    new DeleteObjectsCommand({
      Bucket: requireEnv('R2_BUCKET'),
      Delete: { Objects: input.keys.map((Key) => ({ Key })) },
    }),
  );
}

/** Build the public URL for an R2 object key under R2_PUBLIC_BASE_URL. */
export function getPublicUrl(key: string): string {
  const base = requireEnv('R2_PUBLIC_BASE_URL').replace(/\/+$/, '');
  const cleanKey = key.replace(/^\/+/, '');
  return `${base}/${cleanKey}`;
}
