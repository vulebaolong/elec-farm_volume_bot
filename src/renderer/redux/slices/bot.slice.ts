import { TPriority } from "@/types/priority-change.type";
import { TSettingSystem } from "@/types/setting-system.type";
import { TVersions } from "@/types/version.type";
import { createSlice } from "@reduxjs/toolkit";

export type TInitialState = {
    isStart: boolean;
    versions: TVersions | null;
    settingSystem: TSettingSystem | null;
    whitelistResetInProgress: boolean;
    priority: TPriority;
};

const initialState: TInitialState = {
    isStart: false,
    versions: null,
    settingSystem: null,
    whitelistResetInProgress: false,
    priority: "normal",
};

const botSlice = createSlice({
    name: "botSlice",
    initialState,
    reducers: {
        SET_IS_START: (state, { payload }) => {
            state.isStart = payload;
        },
        SET_VERSIONS: (state, { payload }) => {
            state.versions = payload;
        },
        SET_SETTING_SYSTEM: (state, { payload }) => {
            state.settingSystem = payload;
        },
        SET_WHITELIST_RESET_IN_PROGRESS: (state, { payload }) => {
            state.whitelistResetInProgress = payload;
        },
        SET_PRIORITY: (state, { payload }) => {
            state.priority = payload;
        },
    },
});

export const { SET_IS_START, SET_VERSIONS, SET_SETTING_SYSTEM, SET_WHITELIST_RESET_IN_PROGRESS, SET_PRIORITY } = botSlice.actions;

export default botSlice.reducer;
