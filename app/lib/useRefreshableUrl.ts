import { useState, useEffect, useRef } from "react";
import { getSignedUrl, ASSETS_BUCKET } from "./storage";

const ONE_YEAR = 365 * 24 * 3600;

/**
 * Returns a src + onError handler for <img> tags backed by Supabase Storage.
 * On load error, if storagePath is provided, issues a fresh 1-year signed URL
 * and retries. Calls onRefreshed(newUrl) so the caller can persist the update.
 */
export function useRefreshableUrl(
  url: string,
  storagePath?: string,
  onRefreshed?: (newUrl: string) => void,
) {
  const [src, setSrc] = useState(url);
  const refreshing = useRef(false);

  useEffect(() => {
    setSrc(url);
    refreshing.current = false;
  }, [url]);

  const onError = async () => {
    if (refreshing.current || !storagePath) return;
    refreshing.current = true;
    const fresh = await getSignedUrl(storagePath, ONE_YEAR, ASSETS_BUCKET);
    if (fresh) {
      setSrc(fresh);
      onRefreshed?.(fresh);
    }
  };

  return { src, onError };
}
