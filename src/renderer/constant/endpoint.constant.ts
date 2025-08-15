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
        USER: "user",
        UPLOAD_AVATAR: "user/upload-avatar",
    },
    TOTP: {
        GENERATE: "totp/generate",
        VERIFY: "totp/verify",
        SAVE: "totp/save",
        DISABLE: "totp/disable",
    },
    ACCOUNT: {
        SAVE_ACCOUNT: "account/save",
        SAVE_POSITION_ACCOUNT: "account/save-position",
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
};
