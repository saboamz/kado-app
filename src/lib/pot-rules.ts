/**
 * The rules a pot obeys, as plain functions.
 *
 * Separate from pot-actions.ts because that file is `'use server'`, and a
 * module marked so may only export async functions — Next refuses to compile
 * anything else in it. A synchronous rule living there took the whole app
 * down with a 500 while every unit test went on passing, because the tests
 * import the module directly and never meet that compiler.
 *
 * So the rules live here: importable by an action, by a component, and by a
 * test, with nothing to trip over.
 */

/**
 * Whether somebody may say they bought the gift.
 *
 * Only a person already in the pot. Otherwise the named breakdown is one
 * click away for anybody who can see the gift: no contribution, nothing at
 * stake, and every name and amount on screen. The claim has to cost
 * something for the information it opens to be worth trusting.
 */
export function mayDeclarePurchase(hasContributed: boolean): boolean {
  return hasContributed;
}
