import { describe, expect, it } from 'vitest';
import {
  canReadDocument,
  canWriteDocument,
  documentListWhere,
} from './access';

describe('documentListWhere', () => {
  it('lists all documents in scope for animal-document with ownerScope=scope', () => {
    expect(
      documentListWhere('user-1', 'animal-document', 'shelter-1', undefined, 'scope'),
    ).toEqual({
      type: 'animal-document',
      scopeId: 'shelter-1',
    });
  });

  it('does not widen access for non-shared types with ownerScope=scope', () => {
    expect(
      documentListWhere('user-1', 'mail', 'shelter-1', undefined, 'scope'),
    ).toEqual({
      type: 'mail',
      scopeId: 'shelter-1',
      id: '00000000-0000-0000-0000-000000000000',
    });
  });

  it('keeps owner filter by default', () => {
    expect(documentListWhere('user-1', 'mail', 'shelter-1')).toEqual({
      type: 'mail',
      scopeId: 'shelter-1',
      OR: [
        { ownerId: 'user-1' },
        { accesses: { some: { userId: 'user-1' } } },
      ],
    });
  });
});

describe('canReadDocument / canWriteDocument for animal-document', () => {
  const otherOwnerDoc = {
    type: 'animal-document',
    ownerId: 'owner-2',
    accesses: [],
  };

  it('allows reading another owner animal-document', () => {
    expect(canReadDocument(otherOwnerDoc, 'user-1')).toBe(true);
  });

  it('allows writing another owner animal-document', () => {
    expect(canWriteDocument(otherOwnerDoc, 'user-1')).toBe(true);
  });

  it('still restricts non-shared document types to owner or accesses', () => {
    const mailDoc = {
      type: 'mail',
      ownerId: 'owner-2',
      accesses: [],
    };
    expect(canReadDocument(mailDoc, 'user-1')).toBe(false);
    expect(canWriteDocument(mailDoc, 'user-1')).toBe(false);
  });
});
