import { usingBlob } from './upload-store';

/**
 * Which storage backend the app picks, and why it matters.
 *
 * On Vercel the function filesystem is ephemeral and unshared: a file written
 * by one invocation is gone on the next and was never visible to any other
 * instance. Writing there does not throw — the upload appears to succeed and
 * 404s seconds later, for everyone including the uploader.
 *
 * So the choice of backend is a deployment-correctness property, not a
 * preference, and it is decided by one thing: whether a Blob token is present.
 * These tests hold that decision in place.
 */
describe('choosing the storage backend', () => {
  const original = process.env.BLOB_READ_WRITE_TOKEN;

  afterEach(() => {
    if (original === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = original;
  });

  it('uses the local disk when no Blob token is configured', () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect(usingBlob()).toBe(false);
  });

  it('switches to Blob as soon as a token is present', () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test_token';
    expect(usingBlob()).toBe(true);
  });

  it('treats an empty token as absent rather than as configured', () => {
    // A variable declared but left blank is the shape a half-finished Vercel
    // setup takes. Treating it as "configured" would send every upload to a
    // client that cannot authenticate, and the failure would arrive at run
    // time on a user's first photo rather than at deploy time.
    process.env.BLOB_READ_WRITE_TOKEN = '';
    expect(usingBlob()).toBe(false);
  });
});
