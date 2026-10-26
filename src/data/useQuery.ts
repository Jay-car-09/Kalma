import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type DependencyList } from 'react';

import { onChange } from './events';

/** Loads data while the screen is in view, and reloads it after any write. */
export function useQuery<T>(load: () => Promise<T>, deps: DependencyList): T | undefined {
  const [data, setData] = useState<T>();
  useFocusEffect(
    useCallback(() => {
      let live = true;
      const run = () => load().then((result) => live && setData(result));
      run();
      const unsubscribe = onChange(run);
      return () => {
        live = false;
        unsubscribe();
      };
    }, deps),
  );
  return data;
}
