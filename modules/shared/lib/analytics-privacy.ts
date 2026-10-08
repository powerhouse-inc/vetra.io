/**
 * Invite codes are bearer secrets (some carry a Claude key), and they sit in the path of
 * `/redeem/<code>`. Analytics must only ever see `/redeem/[code]`.
 *
 * The hooks below run inside third-party scripts, so they are plain JavaScript source that the
 * root layout inlines: Umami calls `window[data-before-send](type, payload)` before every send
 * and posts whatever it returns; OpenPanel's Next.js component inlines its `filter` option as a
 * function that receives each event before it is sent. Both are verified against the shipped
 * scripts (umami script.js, @openpanel/sdk `send`), and the unit test runs this exact source.
 */

/** `(url) => url` with any `/redeem/<code>` path replaced; works on paths and full URLs. */
export const SCRUB_URL_JS = String.raw`function (u) {
  return typeof u === 'string'
    ? u.replace(/^((?:[a-z][a-z0-9+.-]*:\/\/[^\/?#]*)?)\/redeem\/[^\/?#]+/i, '$1/redeem/[code]')
    : u
}`

/** Name of the global Umami looks up through `data-before-send`. */
export const UMAMI_BEFORE_SEND = '__vetraUmamiBeforeSend'

/** Defines the Umami hook. Scrubs the page URL and the referrer (in a SPA, the previous page). */
export const UMAMI_BEFORE_SEND_JS = `window.${UMAMI_BEFORE_SEND} = function (type, payload) {
  var scrub = ${SCRUB_URL_JS};
  if (payload && typeof payload === 'object') {
    payload.url = scrub(payload.url);
    payload.referrer = scrub(payload.referrer);
  }
  return payload;
};`

/** OpenPanel `filter`: scrubs the screen-view path and the referrer, then lets the event go. */
export const OPENPANEL_FILTER_JS = `function (event) {
  var scrub = ${SCRUB_URL_JS};
  var props = event && event.payload && event.payload.properties;
  if (props) {
    if ('__path' in props) props.__path = scrub(props.__path);
    if ('__referrer' in props) props.__referrer = scrub(props.__referrer);
  }
  return true;
}`
