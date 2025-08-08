import { createSlice } from "@reduxjs/toolkit";

export type TInitialState = {
    isStart: boolean;
};

const initialState: TInitialState = {
    isStart: false,
};

const botSlice = createSlice({
    name: "botSlice",
    initialState,
    reducers: {
        SET_IS_START: (state, { payload }) => {
            state.isStart = payload;
        },
    },
});

export const { SET_IS_START } = botSlice.actions;

export default botSlice.reducer;
