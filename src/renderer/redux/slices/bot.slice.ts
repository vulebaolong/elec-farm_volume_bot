import { TPriority } from "@/types/priority-change.type";
import { TSettingSystem } from "@/types/setting-system.type";
import { TUiSelector } from "@/types/ui-selector.type";
import { TVersions } from "@/types/version.type";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type TInitialState = {
    isRunning: boolean;
    isStart: boolean;
    ripples: number[];
    maxRipples: number;
    versions: TVersions | null;
    settingSystem: TSettingSystem | null;
    whitelistResetInProgress: boolean;
    priority: TPriority;
    uiSelector: TUiSelector[] | null;
    isChildView: boolean;
};

const initialState: TInitialState = {
    isRunning: false,
    isStart: false,
    ripples: [],
    maxRipples: 16,
    versions: null,
    settingSystem: null,
    whitelistResetInProgress: false,
    priority: "normal",
    uiSelector: null,
    isChildView: false,
};

const genRippleId = () => (Date.now() << 8) | (Math.random() * 256) | 0;

const botSlice = createSlice({
    name: "botSlice",
    initialState,
    reducers: {
        SET_IS_RUNNING: (state, { payload }) => {
            state.isRunning = payload;
        },
        SET_IS_START: (state, { payload }) => {
            state.isStart = payload;
        },
        ADD_RIPPLE(state, action: PayloadAction<number | undefined>) {
            const id = action.payload ?? genRippleId();
            state.ripples.push(id);
            if (state.ripples.length > state.maxRipples) {
                state.ripples.splice(0, state.ripples.length - state.maxRipples);
            }
        },
        REMOVE_RIPPLE(state, action: PayloadAction<number>) {
            state.ripples = state.ripples.filter((x) => x !== action.payload);
        },
        CLEAR_RIPPLES(state) {
            state.ripples = [];
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
        SET_UI_SELECTOR: (state, { payload }) => {
            state.uiSelector = payload;
        },
        SET_IS_CHILD_VIEW: (state, { payload }) => {
            state.isChildView = payload;
        },
    },
});

export const {
    SET_IS_RUNNING,
    SET_IS_START,
    ADD_RIPPLE,
    REMOVE_RIPPLE,
    CLEAR_RIPPLES,
    SET_VERSIONS,
    SET_SETTING_SYSTEM,
    SET_WHITELIST_RESET_IN_PROGRESS,
    SET_PRIORITY,
    SET_UI_SELECTOR,
    SET_IS_CHILD_VIEW,
} = botSlice.actions;

export default botSlice.reducer;
