export type TBaseTimestamps = {
   isDeleted: boolean;
   createdAt: string;
   updatedAt: string;
};

export type TSocketRes<T> = {
   message: string;
   data: T;
};
