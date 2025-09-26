import { combineReducers } from "redux";
import bot from "./bot.slice";
import ga from "./ga.slice";
import user from "./user.slice";

const combinedReducer = combineReducers({
    user,
    ga,
    bot,
});

export const rootReducer = (state: any, action: any) => {
    // RESET STORE (all slice) TO INIT
    //    if (action.type === "userSlice/RESET_USER") state = undefined;
    return combinedReducer(state, action);
};
