export interface FilterProfile {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  agent?: string;
  status?: string;
  payment?: string;
  depositType?: string;
  done?: string;
  verified?: string;
  dateFrom?: string;
  dateTo?: string;
  includeKeyword?: string;
  excludeKeyword?: string;
  description?: string;
}

export interface FilterProfileFormData extends Omit<FilterProfile, 'id'> {
  id?: string;
}
