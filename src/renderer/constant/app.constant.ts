export const IS_PRODUCTION = false;
// export const IS_PRODUCTION = true;

export const BASE_URL = IS_PRODUCTION ? ` https://farmvol.feliciastation.com/api/` : ` http://localhost:3069/api/`;
export const BASE_DOMAIN = IS_PRODUCTION ? `https://farmvol.feliciastation.com/` : `http://localhost:3069/`;

export const TIMEOUT_POSITION = IS_PRODUCTION ? 90_000 : 90_000;

export const TAKE_PROFIT = IS_PRODUCTION ? 0.5 : 3;
export const STOP_LOSS = IS_PRODUCTION ? 5 : 5;

export const MIN_DELAY = 2_000;
export const MAX_DELAY = 3_000;

export const ACCESS_TOKEN_KEY = "U2FsdGVkX1/PGRHiSgRPAwQ6+4jyZrFjcSCT2WPP9/UEE0s=";
export const REFRESH_TOKEN_KEY = "U2FsdGVkX18K8l1hJ+jkZE7n4s9nT2zikEiMNUSjAnm0";
