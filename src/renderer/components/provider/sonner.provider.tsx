import { Toaster } from '@/components/ui/sonner';

type TProps = {
  children: React.ReactNode;
};

export default function SonnerProvider({ children }: TProps) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
