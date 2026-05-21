import 'server-only';

import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

type EnvKey =
  | 'AWS_REGION'
  | 'AWS_ACCESS_KEY_ID'
  | 'AWS_SECRET_ACCESS_KEY'
  | 'S3_BUCKET'
  | 'S3_PUBLIC_BASE_URL';

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
  // AWS S3: the SDK derives the endpoint from `region`. No custom endpoint needed
  // (unlike the previous R2 wiring, which routed through `<account>.r2.cloudflarestorage.com`).
  cachedClient = new S3Client({
    region: requireEnv('AWS_REGION'),
    credentials: {
      accessKeyId: requireEnv('AWS_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('AWS_SECRET_ACCESS_KEY'),
    },
  });
  return cachedClient;
}

export type UploadObjectInput = {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
};

/** Upload an object to the configured S3 bucket. */
export async function uploadObject(input: UploadObjectInput): Promise<void> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: requireEnv('S3_BUCKET'),
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );
}

/** Delete one or more objects from the configured S3 bucket. */
export async function deleteObjects(input: { keys: string[] }): Promise<void> {
  if (input.keys.length === 0) return;
  const client = getClient();
  await client.send(
    new DeleteObjectsCommand({
      Bucket: requireEnv('S3_BUCKET'),
      Delete: { Objects: input.keys.map((Key) => ({ Key })) },
    }),
  );
}

/** Build the public URL for an S3 object key under S3_PUBLIC_BASE_URL. */
export function getPublicUrl(key: string): string {
  const base = requireEnv('S3_PUBLIC_BASE_URL').replace(/\/+$/, '');
  const cleanKey = key.replace(/^\/+/, '');
  return `${base}/${cleanKey}`;
}
