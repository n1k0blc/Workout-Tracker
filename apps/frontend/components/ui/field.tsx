import * as React from 'react';

import { cn } from '@/lib/utils';

const Field = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    'data-invalid'?: boolean;
    'data-disabled'?: boolean;
  }
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-slot="field"
      className={cn('grid gap-2', className)}
      {...props}
    />
  );
});
Field.displayName = 'Field';

const FieldLabel = React.forwardRef<
  React.ElementRef<'label'>,
  React.ComponentPropsWithoutRef<'label'>
>(({ className, ...props }, ref) => {
  return (
    <label
      ref={ref}
      data-slot="field-label"
      className={cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className
      )}
      {...props}
    />
  );
});
FieldLabel.displayName = 'FieldLabel';

const FieldDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  return (
    <p
      ref={ref}
      data-slot="field-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
});
FieldDescription.displayName = 'FieldDescription';

const FieldGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-slot="field-group"
      className={cn('grid gap-4', className)}
      {...props}
    />
  );
});
FieldGroup.displayName = 'FieldGroup';

/**
 * The three kinds of feedback (#222): a field error (this), a field warning (`FieldWarning`) and
 * a toast (`lib/toast.ts`). A field error is red text directly under its field and blocks saving;
 * the field itself carries `aria-invalid` (see `useFormErrors`). Renders nothing without a message.
 */
const FieldError = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => {
  if (!children) return null;
  return (
    <p
      role="alert"
      data-slot="field-error"
      className={cn('text-sm text-destructive', className)}
      {...props}
    >
      {children}
    </p>
  );
};

/**
 * Amber hint under a field for "you can save anyway". The field gets `data-warning="true"` for
 * the amber border. Not an alert: it must not interrupt a screen reader.
 */
const FieldWarning = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => {
  if (!children) return null;
  return (
    <p
      data-slot="field-warning"
      className={cn('text-sm text-amber-600 dark:text-amber-400', className)}
      {...props}
    >
      {children}
    </p>
  );
};

export { Field, FieldLabel, FieldDescription, FieldGroup, FieldError, FieldWarning };
