import { store } from '@/redux/store';
import { Provider } from 'react-redux';

type TProps = {
  children: React.ReactNode;
};

export default function ReduxProvider({ children }: TProps) {
  return <Provider store={store}>{children}</Provider>;
}
