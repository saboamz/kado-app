import { canViewList } from './relations';

describe('list visibility', () => {
  it('always lets the owner in', () => {
    for (const v of ['PRIVATE', 'FRIENDS', 'PUBLIC'] as const) {
      expect(canViewList(v, 'owner')).toBe(true);
    }
  });

  it('keeps a private list to the owner alone', () => {
    expect(canViewList('PRIVATE', 'friend')).toBe(false);
    expect(canViewList('PRIVATE', 'stranger')).toBe(false);
  });

  it('opens a friends list to friends only', () => {
    expect(canViewList('FRIENDS', 'friend')).toBe(true);
    expect(canViewList('FRIENDS', 'stranger')).toBe(false);
  });

  it('opens a public list to anyone', () => {
    expect(canViewList('PUBLIC', 'friend')).toBe(true);
    expect(canViewList('PUBLIC', 'stranger')).toBe(true);
  });
});
