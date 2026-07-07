import { useState } from 'react';
import { CycleFormData } from './cycle-wizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BasicInfoStepProps {
  formData: CycleFormData;
  updateFormData: (data: Partial<CycleFormData>) => void;
  onNext: () => void;
}

export default function BasicInfoStep({
  formData,
  updateFormData,
  onNext,
}: BasicInfoStepProps) {
  const [durationInput, setDurationInput] = useState(String(formData.duration));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  const isValid = formData.name.trim().length > 0 && formData.duration > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Zyklus-Name *</Label>
        <Input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => updateFormData({ name: e.target.value })}
          placeholder="z.B. Push/Pull/Legs 8 Wochen"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="duration">Dauer (Wochen) *</Label>
        <Input
          id="duration"
          type="number"
          value={durationInput}
          onChange={(e) => {
            const raw = e.target.value;
            setDurationInput(raw);
            const parsed = parseInt(raw, 10);
            if (!isNaN(parsed)) {
              updateFormData({ duration: parsed });
            }
          }}
          onBlur={() => {
            const parsed = parseInt(durationInput, 10);
            const clamped = isNaN(parsed) ? 1 : Math.min(52, Math.max(1, parsed));
            setDurationInput(String(clamped));
            updateFormData({ duration: clamped });
          }}
          min="1"
          max="52"
          required
        />
        <p className="text-sm text-muted-foreground">
          Wie viele Wochen soll dieser Zyklus dauern? (1-52)
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="startDate">Start-Datum *</Label>
        <Input
          id="startDate"
          type="date"
          value={formData.startDate}
          onChange={(e) => updateFormData({ startDate: e.target.value })}
          required
        />
      </div>

      <div className="pt-2">
        <Button type="submit" className="w-full" disabled={!isValid}>
          Weiter
        </Button>
      </div>
    </form>
  );
}
