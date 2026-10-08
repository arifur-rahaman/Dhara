import { AwsV4Signer } from 'aws4fetch';
import { describe, expect, it } from 'vitest';

/**
 * Pre-signed URL signing matches AWS's own worked example ("Authenticating Requests: Using Query
 * Parameters (AWS Signature Version 4)" in the Amazon S3 API reference: GET examplebucket/test.txt,
 * example keys, 2013-05-24, 86400 seconds).
 */
describe('S3 pre-signed URLs (SigV4)', () => {
  it('reproduces the AWS documentation example signature', async () => {
    const url = new URL('https://examplebucket.s3.amazonaws.com/test.txt');
    url.searchParams.set('X-Amz-Expires', '86400');
    const signer = new AwsV4Signer({
      url: url.toString(),
      method: 'GET',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      service: 's3',
      region: 'us-east-1',
      signQuery: true,
      datetime: '20130524T000000Z',
    });
    const { url: signed } = await signer.sign();
    expect(signed.searchParams.get('X-Amz-Signature')).toBe(
      'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    );
  });
});
