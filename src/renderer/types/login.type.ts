export type TLoginReq = {
  email: string;
  password: string;
};

export type TLoginRes = {
  accessToken: string;
  refreshToken: string;
};

export type TRefreshTokenReq = {
  accessToken: string;
  refreshToken: string;
};

export type TRefreshTokenRes = {
  accessToken: string;
  refreshToken: string;
};
