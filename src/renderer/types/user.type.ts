import { TBaseTimestamps } from "./base.type";
import { TRole } from "./role.type";
import { TSettingUsers } from "./setting-user.type";
import { TUid } from "./uid.type";

export type TUser = {
    id: number;
    roleId: number;
    settingUserId: number;
    email: string;
    fullName: string;
    avatar: any;
    googleId: any;
    isLoginAllowed: boolean;
    Roles: TRole;
    SettingUsers: TSettingUsers;
    Uids: TUid[] | [];
} & TBaseTimestamps;

export type TUserManager = Omit<TUser, "SettingUsers">;

export type TUploadAvatarLocalRes = {
    folder: string;
    filename: string;
    imgUrl: string;
};

export type TEditProfileReq = {
    id: number;
    fullName: string;
};
