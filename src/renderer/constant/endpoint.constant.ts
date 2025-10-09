export const ENDPOINT = {
    AUTH: {
        LOGIN: `auth/login`,
        CREATE_MAGIC_LINK: `auth/create-magic-link`,
        VERIFY_MAGIC_LINK: `auth/verify-magic-link`,
        REGISTER: `auth/register`,
        REFRESH_TOKEN: `auth/refresh-token`,
        GET_INFO: `auth/get-info`,
        RESET_PASSWORD: `auth/reset-password`,
        SEND_EMAIL: `auth/send-email`,
    },
    ROLE: {
        ROLE: `role`,
        TOGGLE_ROLE: `role/toggle`,
    },
    PERMISSION: {
        PERMISSION: `permission`,
        LIST_PERMISSION_BY_ROLE: `permission/list-by-role`,
    },
    ROLE_PERMISSION: {
        TOGGLE_ROLE_PERMISSION: `role-permission/toggle`,
    },
    USER: {
        LIST_USER: "user",
        UPLOAD_AVATAR: "user/upload-avatar",
        LOGIN_TRUE: "user/login-true",
        LOGIN_FALSE: "user/login-false",
    },
    TOTP: {
        GENERATE: "totp/generate",
        VERIFY: "totp/verify",
        SAVE: "totp/save",
        DISABLE: "totp/disable",
    },
    ACCOUNT: {
        UPSERT: "account/upsert",
    },
    SETTING_SYSTEM: {
        GET_SETTING_SYSTEM: "setting-system",
        UPDATE_SETTING_SYSTEM: "setting-system",
    },
    SETTING_USER: {
        UPDATE_SETTING_USER: "setting-user",
    },
    WHITE_LIST: {
        GET_WHITE_LIST: "white-list",
    },
    PRIORITY_24h_CHANGE: {
        GET_PRIORITY_24h_CHANGE: "priority-24h-change",
    },
    UI_SELECTOR: {
        GET_UI_SELECTOR: "ui-selector",
        UPSERT_UI_SELECTOR: "ui-selector/upsert",
    },
    CONTRACT: {
        GET_CONTRACT: "contract",
        GET_CONTRACT_SYMBOL: "contract/symbol",
        GET_INFO_CONTRACT: "contract/get-info-cal-contract",
    },
    HELPER: {
        LAST_PRICE: "helper/last-price-by-contract",
    },
    BLACK_LIST: {
        GET_BLACK_LIST: "black-list",
        GET_MY_BLACK_LIST: "black-list/my",
        CREATE_BLACK_LIST: "black-list",
        REMOVE_BLACK_LIST: "black-list",
        CLEAR_ALL_BLACK_LIST: "black-list/clear-all",
    },
    WHITE_LIST_MARTINGALE: {
        GET_WHITE_LIST_MARTINGALE: "white-list-martingale",
        GET_ALL_WHITE_LIST_MARTINGALE: "white-list-martingale/all",
        CREATE_WHITE_LIST_MARTINGALE: "white-list-martingale",
        REMOVE_WHITE_LIST_MARTINGALE: "white-list-martingale",
        CLEAR_ALL_WHITE_LIST_MARTINGALE: "white-list-martingale/clear-all",
    },
    WHITE_LIST_FARM_IOC: {
        GET_WHITE_LIST_FARM_IOC: "white-list-farm-ioc",
        GET_ALL_WHITE_LIST_FARM_IOC: "white-list-farm-ioc/all",
        CREATE_WHITE_LIST_FARM_IOC: "white-list-farm-ioc",
        REMOVE_WHITE_LIST_FARM_IOC: "white-list-farm-ioc",
        CLEAR_ALL_WHITE_LIST_FARM_IOC: "white-list-farm-ioc/clear-all",
    },
    WHITE_LIST_SCALP_IOC: {
        GET_WHITE_LIST_SCALP_IOC: "white-list-scalp-ioc",
        GET_ALL_WHITE_LIST_SCALP_IOC: "white-list-scalp-ioc/all",
        CREATE_WHITE_LIST_SCALP_IOC: "white-list-scalp-ioc",
        REMOVE_WHITE_LIST_SCALP_IOC: "white-list-scalp-ioc",
        CLEAR_ALL_WHITE_LIST_SCALP_IOC: "white-list-scalp-ioc/clear-all",
    },
    CCC: {
        GET_SIDE: "https://api-coincraze.feliciastation.com/api/v1/tool/pnl-safe-mode/strong-side",
    },
    TAKEPROFIT_ACCOUNT: {
        CREATE: "takeprofit-account",
        UPDATE: "takeprofit-account",
        GET: "takeprofit-account",
    },
    FIX_LIQUIDATION: {
        UPSERT: "fix-liquidation/upsert",
        GET: "fix-liquidation",
    },
    FIX_STOPLOSS: {
        UPSERT: "fix-stoploss/upsert",
        GET: "fix-stoploss",
    },
    FIX_STOPLOSS_QUEUE: {
        UPSERT: "fix-stoploss-queue/upsert",
        GET_ONE: "fix-stoploss-queue/one",
    },
    FIX_STOPLOSS_HISTORIES: {
        CREATE: "fix-stoploss-histories",
    },
};
