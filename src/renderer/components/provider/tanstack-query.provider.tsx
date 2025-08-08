import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      gcTime: 0,
      staleTime: 0,
    },
  },
});

type TProps = {
  children: React.ReactNode;
};

export default function TanstackQueryProvider({ children }: TProps) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
