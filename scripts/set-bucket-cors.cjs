// One-off: apply a CORS rule to the tribute S3 bucket so the browser can
// fetch() the composed video for download (the <video> player works without
// CORS, but fetch()->blob() is blocked cross-origin without it).
//
// Reads AWS creds + bucket from the app's .env (same dir). Run on the box:
//   NODE_PATH=/home/zeeshan/apps/peterna-builder/node_modules \
//     node /tmp/set-bucket-cors.cjs
const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

(async () => {
  const env = { ...loadEnv(path.join(__dirname, '.env')), ...process.env };
  const region = env.AWS_REGION || 'us-east-1';
  const bucket = env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET not set');
  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) throw new Error('AWS creds missing');

  const {
    S3Client,
    PutBucketCorsCommand,
    GetBucketCorsCommand,
  } = require('@aws-sdk/client-s3');

  const client = new S3Client({
    region,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const CORSConfiguration = {
    CORSRules: [
      {
        // Objects are already public-read; a wildcard GET/HEAD CORS rule exposes
        // nothing new and lets the builder (any origin) fetch+download the video.
        AllowedOrigins: ['*'],
        AllowedMethods: ['GET', 'HEAD'],
        AllowedHeaders: ['*'],
        ExposeHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag', 'Content-Type'],
        MaxAgeSeconds: 3600,
      },
    ],
  };

  await client.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration }));
  console.log('PUT CORS ok for bucket', bucket);

  const got = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
  console.log('VERIFY:', JSON.stringify(got.CORSRules, null, 2));
})().catch((e) => {
  console.error('FAILED:', e.name, e.message);
  process.exit(1);
});
