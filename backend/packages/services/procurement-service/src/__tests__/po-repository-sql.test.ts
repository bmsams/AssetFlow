import fs from 'node:fs';
import path from 'node:path';

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(filePath), 'utf8');
}

describe('Procurement PO repository SQL', () => {
  it('references purchase_order_lines and not po_lines', () => {
    const src = read(path.resolve(__dirname, '..', 'purchase-order', 'po-repository.ts'));

    expect(src).toContain('purchase_order_lines');
    expect(src).not.toMatch(/\bpo_lines\b/);
  });
});
