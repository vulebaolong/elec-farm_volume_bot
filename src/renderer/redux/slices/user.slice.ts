import { TUser } from "@/types/user.type";
import { createSlice } from "@reduxjs/toolkit";

type TInitialState = {
   info: TUser | null;
   isInitWorker: boolean;
};

const initialState: TInitialState = {
   info: null,
   isInitWorker: true,
};

const userSlice = createSlice({
   name: "userSlice",
   initialState,
   reducers: {
      SET_INFO: (state, { payload }) => {
         state.info = payload;
      },
      SET_IS_INIT_WORKER: (state, { payload }) => {
         state.isInitWorker = payload;
      },
      RESET_USER: () => initialState,
   },
});

export const { RESET_USER, SET_INFO, SET_IS_INIT_WORKER } = userSlice.actions;

export default userSlice.reducer;
