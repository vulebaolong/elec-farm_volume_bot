import { ENDPOINT } from "@/constant/endpoint.constant";
import { getSideRes } from "@/types/ccc.type";
import { EntrySignalMode } from "@/types/enum/entry-signal-mode.enum";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export const useGetSideCCC = (entryMode?: EntrySignalMode) => {
    return useQuery({
        queryKey: ["get-side-ccc", entryMode],
        queryFn: async () => {
            try {
                const { data } = await axios.get<getSideRes>(ENDPOINT.CCC.GET_SIDE);
                console.log("useGetSideCCC: ", data);
                return data.side;
            } catch (error) {
                console.log("useGetSideCCC: ", error);
                return null;
            }
        },
        enabled: entryMode === EntrySignalMode.SIDE_CCC,
        refetchInterval: 2000,
    });
};
