import { beforeAll, describe, expect, it } from 'vitest';

// Signing is local (no network): fake credentials are enough.
beforeAll(() => {
  process.env.S3_BUCKET = 'test-bucket';
  process.env.S3_REGION = 'eu-west-3';
  process.env.AWS_ACCESS_KEY_ID = 'AKIATESTTESTTESTTEST';
  process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-access-key';
});

describe('s3 signing', () => {
  it('issues a presigned POST locked to the key, type and max size', async () => {
    const { createUploadTicket, isStorageConfigured } = await import('./s3');
    expect(isStorageConfigured()).toBe(true);

    const ticket = await createUploadTicket({
      key: 'shelter/s1/uuid-1',
      mimeType: 'image/png',
      maxSizeBytes: 1024,
    });

    expect(ticket.url).toContain('test-bucket');
    expect(ticket.fields.key).toBe('shelter/s1/uuid-1');
    expect(ticket.fields['Content-Type']).toBe('image/png');

    const policy = JSON.parse(Buffer.from(ticket.fields.Policy, 'base64').toString('utf8')) as {
      conditions: unknown[];
    };
    expect(policy.conditions).toContainEqual(['content-length-range', 1, 1024]);
    expect(policy.conditions).toContainEqual(['eq', '$Content-Type', 'image/png']);
    expect(policy.conditions).toContainEqual({ key: 'shelter/s1/uuid-1' });
  });

  it('signs read URLs with the display name', async () => {
    const { signReadUrl } = await import('./s3');
    const { url } = await signReadUrl({ key: 'shelter/s1/uuid-1', fileName: 'Été.pdf', download: true });
    const params = new URL(url).searchParams;
    expect(params.get('response-content-disposition')).toBe(
      `attachment; filename="_t_.pdf"; filename*=UTF-8''%C3%89t%C3%A9.pdf`,
    );
    expect(params.get('X-Amz-Expires')).toBe('3600');
  });
});
