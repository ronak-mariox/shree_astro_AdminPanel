/**
 * Turning an image path from the API into something an <img> can load.
 *
 * Uploads are served by the API itself under `/uploads/...`, so a relative
 * path has to be prefixed with the API's origin — the panel may be on a
 * different port or host. An absolute URL (S3, a CDN) is left alone.
 */

import { API_BASE_URL } from '../services/client';

/** `http://localhost:5000/api/v1` → `http://localhost:5000`. */
export const MEDIA_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export function mediaUrl(path) {
  if (!path) return undefined;
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('blob:') || path.startsWith('data:')) {
    return path;
  }
  return `${MEDIA_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}
