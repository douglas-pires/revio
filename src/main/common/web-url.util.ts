const WEB_URL = /^https?:/u

/** Whether `url` is an http(s) link, the only kind the app hands to the browser. */
export const isWebUrl = (url: string) => WEB_URL.test(url)
