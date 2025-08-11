import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import React from "react";
import MantineProvider from "./mantine.provider";
import ReduxProvider from "./redux.provider";
import SocketProvider from "./socket-provider";
import SonnerProvider from "./sonner.provider";
import TanstackQueryProvider from "./tanstack-query.provider";

dayjs.extend(relativeTime);
dayjs.extend(duration);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

type TProps = {
    children: React.ReactNode;
};

export default function Provider({ children }: TProps) {
    return (
        <TanstackQueryProvider>
            <ReduxProvider>
                <MantineProvider>
                    <SocketProvider>
                        <SonnerProvider>{children}</SonnerProvider>
                    </SocketProvider>
                </MantineProvider>
            </ReduxProvider>
        </TanstackQueryProvider>
    );
}
