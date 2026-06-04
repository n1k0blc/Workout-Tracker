import { IconListCheck } from '@tabler/icons-react';

interface SetsSlideProps {
  count: number;
}

export function SetsSlide({ count }: SetsSlideProps) {
  return (
    <div className="text-center space-y-6 animate-fadeIn">
      <div className="flex justify-center">
        <div className="p-4 bg-primary/10 rounded-full">
          <IconListCheck className="h-12 w-12 text-primary" />
        </div>
      </div>
      
      <h2 className="text-2xl font-semibold text-foreground">
        Arbeitssätze
      </h2>
      
      <div className="space-y-2">
        <div className="text-6xl font-bold text-primary">
          {count}
        </div>
        <div className="text-xl text-muted-foreground">
          {count === 1 ? 'Satz' : 'Sätze'}
        </div>
      </div>
      
      <p className="text-muted-foreground max-w-md mx-auto">
        Arbeitssätze absolviert (ohne Aufwärmsätze)
      </p>
    </div>
  );
}
