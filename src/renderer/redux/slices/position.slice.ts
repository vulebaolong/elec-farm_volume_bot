import { createSlice } from '@reduxjs/toolkit';

export type TInitialState = {
  totalOpenPO: number | null;
  poPerToken: Record<string, number> | null;
};

const initialState: TInitialState = {
  totalOpenPO: null,
  poPerToken: null,
};

const positionSlice = createSlice({
  name: 'positionSlice',
  initialState,
  reducers: {
    SET_COUNT_POSITION: (state, { payload }) => {
      state.totalOpenPO = payload.totalOpenPO;
      state.poPerToken = payload.poPerToken;
    },
  },
});

export const { SET_COUNT_POSITION } = positionSlice.actions;

export default positionSlice.reducer;
