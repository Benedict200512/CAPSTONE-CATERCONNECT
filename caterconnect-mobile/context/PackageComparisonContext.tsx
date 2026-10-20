import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { toggleComparisonPackage } from '../lib/packageComparison';

type ComparisonContext = {
  customerId: string | null; selectedIds: string[];
  toggle: (id: string) => void; remove: (id: string) => void; clear: () => void;
};
const Context = createContext<ComparisonContext | null>(null);

export function PackageComparisonProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth();
  const customerId = profile?.id === session?.user.id && profile?.role === 'customer'
    ? session?.user.id ?? null : null;
  const identity = useRef(customerId);
  identity.current = customerId;
  const selection = useRef<{ owner: string | null; ids: string[] }>({ owner: null, ids: [] });
  const [state, setState] = useState(selection.current);
  useEffect(() => {
    if (selection.current.owner !== customerId) {
      selection.current = { owner: customerId, ids: [] };
      setState(selection.current);
    }
  }, [customerId]);
  const update = (change: (ids: string[]) => string[]) => {
    if (!customerId || identity.current !== customerId) throw new Error('Sign in with a customer account to compare packages.');
    const ids = selection.current.owner === customerId ? selection.current.ids : [];
    selection.current = { owner: customerId, ids: change(ids) };
    setState(selection.current);
  };
  return <Context.Provider value={{ customerId,
    selectedIds: customerId && state.owner === customerId ? state.ids : [],
    toggle: id => update(ids => toggleComparisonPackage(ids, id)),
    remove: id => update(ids => ids.filter(value => value !== id)),
    clear: () => update(() => []),
  }}>{children}</Context.Provider>;
}

export function usePackageComparison() {
  const context = useContext(Context);
  if (!context) throw new Error('Package comparison must be inside the customer navigator.');
  return context;
}
