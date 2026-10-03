import {
  IconCoffee,
  IconSoup,
  IconMeat,
  IconApple,
  IconToolsKitchen2,
} from '@tabler/icons-react';

const BY_SEED_KEY: Record<string, React.ComponentType<{ className?: string }>> = {
  breakfast: IconCoffee,
  lunch: IconSoup,
  dinner: IconMeat,
  snacks: IconApple,
};

/** The tile icon for an Abschnitt. Falls back to a generic kitchen icon for renamed slots. */
export function SlotIcon({ seedKey, className }: { seedKey: string | null; className?: string }) {
  const Icon = (seedKey && BY_SEED_KEY[seedKey]) || IconToolsKitchen2;
  return <Icon className={className} />;
}
