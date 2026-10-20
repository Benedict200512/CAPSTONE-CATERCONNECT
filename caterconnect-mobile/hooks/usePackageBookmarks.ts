import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import {
  bookmarkError, loadPackageBookmarks, loadSavedPackageDetails,
  removePackageBookmark, savePackageBookmark, type PackageBookmark, type SavedPackage,
} from '../lib/packageBookmarks';

export function usePackageBookmarks(includeDetails = false) {
  const { session, profile } = useAuth();
  // Do not trust a stale profile from the preceding account or editable metadata.
  const customerId = profile?.id === session?.user.id && profile?.role === 'customer'
    ? session?.user.id ?? null : null;
  const identity = useRef({ id: customerId, generation: 0 });
  if (identity.current.id !== customerId) {
    identity.current = { id: customerId, generation: identity.current.generation + 1 };
  }
  const mounted = useRef(true);
  const loadVersion = useRef(0);
  const locks = useRef(new Set<string>());
  const [state, setState] = useState<{
    owner: string | null; rows: PackageBookmark[]; details: SavedPackage[];
    loading: boolean; error: string | null; pending: Set<string>;
  }>({ owner: null, rows: [], details: [], loading: false, error: null, pending: new Set() });

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; loadVersion.current++; };
  }, []);
  useEffect(() => {
    locks.current = new Set();
    setState({ owner: customerId, rows: [], details: [], loading: !!customerId, error: null, pending: new Set() });
  }, [customerId]);

  const refresh = useCallback(async () => {
    if (!customerId || identity.current.id !== customerId || !mounted.current) return;
    const generation = identity.current.generation;
    const version = ++loadVersion.current;
    const current = () => mounted.current && identity.current.generation === generation
      && identity.current.id === customerId && version === loadVersion.current;
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const rows = await loadPackageBookmarks(customerId);
      const details = includeDetails ? await loadSavedPackageDetails(rows) : [];
      if (current()) setState(prev => ({ ...prev, owner: customerId, rows, details, loading: false }));
    } catch (error) {
      if (current()) setState(prev => ({ ...prev, owner: customerId, details: [], loading: false, error: bookmarkError(error) }));
    }
  }, [customerId, includeDetails]);

  useFocusEffect(useCallback(() => {
    void refresh();
    return () => { loadVersion.current++; };
  }, [refresh]));

  const change = async (packageId: string, save: boolean): Promise<void> => {
    if (!customerId || identity.current.id !== customerId) {
      throw new Error('Please sign in with a customer account to save packages.');
    }
    const generation = identity.current.generation;
    const key = `${generation}:${packageId}`;
    if (locks.current.has(key)) return;
    const current = () => mounted.current && identity.current.generation === generation
      && identity.current.id === customerId;
    locks.current.add(key);
    loadVersion.current++; // An older list response must not undo this mutation.
    setState(prev => ({ ...prev, loading: false, pending: new Set(prev.pending).add(packageId) }));
    try {
      await (save ? savePackageBookmark : removePackageBookmark)(customerId, packageId);
      if (current()) {
        // The write is confirmed: keep local state accurate even if refresh fails.
        setState(prev => ({ ...prev,
          rows: save ? prev.rows.some(row => row.package_id === packageId) ? prev.rows
            : [{ package_id: packageId, created_at: new Date().toISOString() }, ...prev.rows]
            : prev.rows.filter(row => row.package_id !== packageId),
          details: save ? prev.details : prev.details.filter(row => row.package_id !== packageId),
        }));
        await refresh();
      }
    } catch (error) {
      if (current()) throw new Error(bookmarkError(error));
    } finally {
      locks.current.delete(key);
      if (current()) setState(prev => {
        const pending = new Set(prev.pending); pending.delete(packageId);
        return { ...prev, pending };
      });
    }
  };

  const own = state.owner === customerId && !!customerId;
  const bookmarks = own ? state.rows : [];
  return {
    customerId, bookmarks, savedPackages: own ? state.details : [],
    loading: !!customerId && (!own || state.loading), error: own ? state.error : null,
    pending: own ? state.pending : new Set<string>(), refresh,
    isBookmarked: (id: string) => bookmarks.some(row => row.package_id === id),
    save: (id: string) => change(id, true), unsave: (id: string) => change(id, false),
  };
}
