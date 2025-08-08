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
    USER: 'user',
    UPLOAD_AVATAR: 'user/upload-avatar',
  },
  TOTP: {
    GENERATE: 'totp/generate',
    VERIFY: 'totp/verify',
    SAVE: 'totp/save',
    DISABLE: 'totp/disable',
  },
  ACCOUNT: {
    SAVE_ACCOUNT: 'account/save',
    SAVE_POSITION_ACCOUNT: 'account/save-position',
  },
  SETTING: {
    GET_SETTING: 'setting',
    UPDATE_SETTING: 'setting',
  },
  WHITE_LIST: {
    GET_WHITE_LIST: 'white-list',
  }
};
