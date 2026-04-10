export class CycleListItem {
  id: string;
  name: string;
  duration: number;
  startDate: Date;
  status: 'ACTIVE' | 'COMPLETED';
  completedAt?: Date;
  createdAt: Date;
}

export class CycleListDto {
  activeCycle?: CycleListItem;
  completedCycles: CycleListItem[];
}
