import { fieldErrors, loginSchema, signupSchema } from './validation';

describe('signup validation', () => {
  it('accepts a valid signup', () => {
    const parsed = signupSchema.safeParse({
      name: '  Sophie  ',
      email: '  SOPHIE@Kado.APP ',
      password: 'kado1234',
    });
    expect(parsed.success).toBe(true);
    // Trimmed and lowercased, so 'A@b.c' and 'a@b.c' cannot become two accounts.
    expect(parsed.success && parsed.data).toMatchObject({
      name: 'Sophie',
      email: 'sophie@kado.app',
    });
  });

  it('rejects a short password', () => {
    const parsed = signupSchema.safeParse({
      name: 'Sophie',
      email: 'sophie@kado.app',
      password: 'court',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(fieldErrors(parsed.error).password).toMatch(/8 caractères/);
    }
  });

  it.each([
    ['missing @', 'sophie.kado.app'],
    ['empty', ''],
  ])('rejects a %s address', (_label, email) => {
    const parsed = signupSchema.safeParse({
      name: 'Sophie',
      email,
      password: 'kado1234',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a blank name', () => {
    const parsed = signupSchema.safeParse({
      name: '   ',
      email: 'sophie@kado.app',
      password: 'kado1234',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('login validation', () => {
  it('does not impose the signup password rules on login', () => {
    // An account created before a rule change must still be able to sign in.
    const parsed = loginSchema.safeParse({
      email: 'sophie@kado.app',
      password: 'old',
    });
    expect(parsed.success).toBe(true);
  });

  it('requires a password to be present', () => {
    const parsed = loginSchema.safeParse({
      email: 'sophie@kado.app',
      password: '',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('fieldErrors', () => {
  it('keeps the first message per field', () => {
    const parsed = signupSchema.safeParse({ name: '', email: 'x', password: '' });
    if (!parsed.success) {
      const errors = fieldErrors(parsed.error);
      expect(Object.keys(errors).sort()).toEqual(['email', 'name', 'password']);
      expect(typeof errors.name).toBe('string');
    }
  });
});
