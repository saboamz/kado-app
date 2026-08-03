'use client';

import { useFormStatus } from 'react-dom';
import { Button } from './Button';

/** Submit button that disables and relabels itself while the action runs. */
export function SubmitButton({
  children,
  pendingLabel,
  block = true,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  block?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" block={block} disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
