'use client';

import { useAuth } from '@/lib/auth-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IconHome, IconBuilding } from '@tabler/icons-react';

interface GymLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGym: (homeGymId: string | null) => void;
  plannedHomeGymId?: string | null;
}

export default function GymLocationModal({
  isOpen,
  onClose,
  onSelectGym,
  plannedHomeGymId,
}: GymLocationModalProps) {
  const { user } = useAuth();

  // Sort home gyms alphabetically
  const homeGyms = [...(user?.homeGyms || [])].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Wo trainierst du heute?</DialogTitle>
          <DialogDescription className="text-center">
            Wähle dein Trainingsort aus
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* Home Gyms */}
          {homeGyms.map((gym) => {
            const isRecommended = plannedHomeGymId === gym.id;
            return (
              <Button
                key={gym.id}
                onClick={() => onSelectGym(gym.id)}
                className="w-full h-auto py-3 flex items-start gap-3 text-left"
                variant="default"
              >
                <IconHome className="size-5 mt-0.5 shrink-0" />
                <div className="flex flex-col items-start">
                  <span>{gym.name}</span>
                  {isRecommended ? (
                    <Badge variant="secondary" className="text-xs mt-0.5">
                      Heute empfohlen
                    </Badge>
                  ) : (
                    <span className="text-xs mt-0.5 invisible">Heute empfohlen</span>
                  )}
                </div>
              </Button>
            );
          })}

          {/* Other Gym */}
          <Button
            onClick={() => onSelectGym(null)}
            className="w-full h-auto py-3 flex items-center justify-center gap-3 text-base"
            variant="outline"
          >
            <IconBuilding className="size-5" />
            <span>Anderes Gym</span>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center pt-2">
          PRs werden nur von Home Gym Workouts gezählt
        </p>
      </DialogContent>
    </Dialog>
  );
}
