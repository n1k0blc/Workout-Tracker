import { useAuth } from '@/lib/auth-context';
import { displayVolume, displayWeight, weightUnitLabel, type UnitSystem } from '@/lib/units';

/** The signed-in user's unit system (#186); metric until the profile has loaded. */
export function useUnitSystem(): UnitSystem {
  return useAuth().user?.unitSystem ?? 'METRIC';
}

/** Display helpers bound to the user's system (#186). All inputs are canonical kg. */
export function useUnits() {
  const system = useUnitSystem();
  return {
    system,
    unit: weightUnitLabel(system),
    weight: (kg: number) => displayWeight(kg, system),
    volume: (kg: number) => displayVolume(kg, system),
  };
}
