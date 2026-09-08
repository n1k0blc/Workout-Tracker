import {
  IconCoffee,
  IconSoup,
  IconMeat,
  IconApple,
  IconToolsKitchen2,
} from '@tabler/icons-react';

const BY_NAME: Record<string, React.ComponentType<{ className?: string }>> = {
  Frühstück: IconCoffee,
  Mittagessen: IconSoup,
  Abendessen: IconMeat,
  Snacks: IconApple,
};

/** The tile icon for an Abschnitt. Falls back to a generic kitchen icon for renamed slots. */
export function SlotIcon({ name, className }: { name: string; className?: string }) {
  const Icon = BY_NAME[name] ?? IconToolsKitchen2;
  return <Icon className={className} />;
}
