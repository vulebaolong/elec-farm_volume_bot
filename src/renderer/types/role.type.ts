import { TBaseTimestamps } from "./base.type";
import { TPermission } from "./permission.type";

export type TRole = {
   id: number;
   name: string;
   description?: string;
   isActive: boolean;
} & TBaseTimestamps;

export type Permissions = {
   [key: string]: TPermission[];
};

export type TToggleRolePermissionReq = {
   roleid: number;
   permissionid: number;
};

export type TToggleRolePermissionRes = {
   isActive: boolean;
};

export type TToggleRoleReq = {
   roleid: number;
};


