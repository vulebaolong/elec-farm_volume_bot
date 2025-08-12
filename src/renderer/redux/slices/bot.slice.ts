import { TVersions } from "@/types/version.type";
import { createSlice } from "@reduxjs/toolkit";

export type TInitialState = {
    isStart: boolean;
    versions: TVersions | null;
};

const initialState: TInitialState = {
    isStart: false,
    versions: null,
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
    },
});

export const { SET_IS_START, SET_VERSIONS } = botSlice.actions;

export default botSlice.reducer;
