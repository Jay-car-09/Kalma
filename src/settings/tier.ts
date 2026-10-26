import { useSettings } from './SettingsProvider';

// The one place the app asks "is this user on Paid?".
// Until real purchases exist (Phase 3), only the dev-only Pretend Paid switch can make this true.
// Release builds are always Free.
export function useIsPaid(): boolean {
  const { pretendPaid } = useSettings();
  return __DEV__ && pretendPaid;
}
