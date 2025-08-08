import { TSetting } from "@/types/setting.type";
import { createSlice } from "@reduxjs/toolkit";

export type TInitialState = {
    settingBot: TSetting | null;
};

const initialState: TInitialState = {
    settingBot: null,
};

const settingSlice = createSlice({
    name: "settingSlice",
    initialState,
    reducers: {
        SET_SETTING_BOT: (state, { payload }) => {
            state.settingBot = payload;
        },
    },
});

export const { SET_SETTING_BOT } = settingSlice.actions;

export default settingSlice.reducer;
