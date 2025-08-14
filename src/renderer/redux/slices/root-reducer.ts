import { combineReducers } from "redux";
import user from "./user.slice";
import ga from "./ga.slice";
import position from "./position.slice";
import bot from "./bot.slice";

const combinedReducer = combineReducers({
    user,
    ga,
    position,
    bot,
});

export const rootReducer = (state: any, action: any) => {
    // RESET STORE (all slice) TO INIT
    //    if (action.type === "userSlice/RESET_USER") state = undefined;
    return combinedReducer(state, action);
};
