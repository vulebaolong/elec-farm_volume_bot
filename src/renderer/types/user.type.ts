import { TBaseTimestamps } from "./base.type";
import { TRole } from "./role.type";

export type TUser = {
   id: number;
   email: string;
   fullName: string;
   avatar?: string;
   googleId?: string;
   roleid: number;
   Roles: TRole;
   isTotp: boolean;
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