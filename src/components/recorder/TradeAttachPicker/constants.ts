/**
 * Sentinel value used for the "+ New trade" option. Has to be a real string
 * because <option> can't carry `undefined`; we translate back to `undefined`
 * in the onChange handler so the parent's contract stays clean.
 */
export const NEW_TRADE_VALUE = "__new__";

export const ATTACHABLE_TRADES_ENDPOINT = "/api/trades?attachable=1";
