import { getOpenSearchClient } from '../client';

describe('OpenSearch client config', () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = { ...original };
    delete process.env['OPENSEARCH_ENDPOINT'];
  });

  afterAll(() => {
    process.env = original;
  });

  it('throws when OPENSEARCH_ENDPOINT is missing', () => {
    expect(() => getOpenSearchClient()).toThrow(/OPENSEARCH_ENDPOINT/i);
  });
});

