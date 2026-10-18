/* Compact layout includes tablets, landscape phones and short desktop windows.
   Keep this query identical to MOBILE_MQ in styles.css. */
export const MOBILE_MQ = '(max-width: 1280px), (max-height: 800px)'
export const isMobile = () => matchMedia(MOBILE_MQ).matches
