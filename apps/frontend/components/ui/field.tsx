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

export { Field, FieldLabel, FieldDescription, FieldGroup };
