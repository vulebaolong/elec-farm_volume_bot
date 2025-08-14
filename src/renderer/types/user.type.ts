import { TBaseTimestamps } from "./base.type";
import { TRole } from "./role.type";
import { TSettingUsers } from "./setting-user.type";

export type TUser = {
    id: number;
    roleId: number;
    settingId: number;
    isLoginAllowed: boolean | null;
    sessionVersion: number;
    email: string;
    fullName: string | null;
    avatar: string | null;
    password: string | null;
    googleId: string | null;
    totpSecret: string | null;
    Roles: TRole;
    SettingUsers: TSettingUsers;
} & TBaseTimestamps;

export type TUploadAvatarLocalRes = {
    folder: string;
    filename: string;
    imgUrl: string;
};

export type TEditProfileReq = {
    id: number;
    fullName: string;
};
