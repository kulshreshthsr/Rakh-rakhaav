/**
 * Helpers for detecting and handling structured API error responses.
 */

/**
 * Returns true when an API response carries the FEATURE_NOT_IN_TIER error code.
 * Pass the fetch Response object and the already-parsed JSON body.
 *
 * @param {Response} response  - The raw fetch Response
 * @param {object}   data      - The parsed JSON body
 */
export function isFeatureLockedError(response, data) {
  return response.status === 403 && data?.code === 'FEATURE_NOT_IN_TIER';
}
