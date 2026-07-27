export interface FilterProfile {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  agent?: string;
  bank?: string;
  status?: string;
  payment?: string;
  /** Iteration 12: `depositType` is retained for backward compatibility
   *  with the untouched monitoring engine, which reads `depositType`.
   *  The UI now labels this field as "Payment" and mirrors it into
   *  both `payment` and `depositType` when the profile is saved. */
  depositType?: string;
  done?: string;
  verified?: string;
  firstDeposit?: string;
  username?: string;
  accountName?: string;
  accountNumber?: string;
  dateFrom?: string;
  dateTo?: string;
  includeKeyword?: string;
  excludeKeyword?: string;
  description?: string;
}

export interface FilterProfileFormData extends Omit<FilterProfile, 'id'> {
  id?: string;
}
