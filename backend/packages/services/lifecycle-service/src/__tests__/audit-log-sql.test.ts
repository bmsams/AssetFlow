import fs from 'node:fs';
import path from 'node:path';

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(filePath), 'utf8');
}

function auditLogInsertColumns(src: string): string {
  const match = src.match(/INSERT INTO audit_log\s*\(([^)]*)\)\s*VALUES/i);
  if (!match) {
    throw new Error('Expected an INSERT INTO audit_log (...) VALUES statement');
  }
  const cols = match[1];
  if (cols === undefined) {
    throw new Error('Expected column capture group for INSERT INTO audit_log');
  }
  return cols;
}

describe('Lifecycle audit_log INSERT SQL', () => {
  it('uses audit_log table and expected columns in deployment repository', () => {
    const src = read(path.resolve(__dirname, '..', 'deployment', 'deployment-repository.ts'));
    const cols = auditLogInsertColumns(src);

    expect(src).toContain('INSERT INTO audit_log');
    expect(cols).toContain('resource_type');
    expect(cols).toContain('resource_id');
    expect(cols).toContain('action_type');
    expect(cols).toContain('user_id');
    expect(cols).toContain('new_values');

    expect(src).not.toContain('INSERT INTO audit_logs');
    expect(cols).not.toContain('entity_type');
    expect(cols).not.toContain('entity_id');
    expect(cols).not.toContain('actor_id');
    expect(cols).not.toContain('changes');
  });

  it('uses audit_log table and expected columns in retirement repository', () => {
    const src = read(path.resolve(__dirname, '..', 'retirement', 'retirement-repository.ts'));
    const cols = auditLogInsertColumns(src);

    expect(src).toContain('INSERT INTO audit_log');
    expect(cols).toContain('resource_type');
    expect(cols).toContain('resource_id');
    expect(cols).toContain('action_type');
    expect(cols).toContain('user_id');
    expect(cols).toContain('new_values');

    expect(src).not.toContain('INSERT INTO audit_logs');
    expect(cols).not.toContain('entity_type');
    expect(cols).not.toContain('entity_id');
    expect(cols).not.toContain('actor_id');
    expect(cols).not.toContain('changes');
  });
});
