import {
  setLocalStorageScript
} from '@/javascript-string/logic-farm';
import { useEffect } from 'react';

type TProps = {
  setIsReady: React.Dispatch<React.SetStateAction<boolean>>;
  webviewRef: React.RefObject<Electron.WebviewTag | null>;
  wvPreload: string;
};

export default function Webview({ setIsReady, webviewRef, wvPreload }: TProps) {
  // open dev tools
  // useEffect(() => {
  //   const webview = webviewRef.current;
  //   if (!webview) return;

  //   const handleDomReady = async () => {
  //     try {
  //       webview.openDevTools();
  //     } catch {}
  //   };

  //   webview.addEventListener('dom-ready', handleDomReady);

  //   return () => {
  //     webview.removeEventListener('dom-ready', handleDomReady);
  //   };
  // }, []);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleDomReady = async () => {
      try {
        const result = await webview.executeJavaScript(setLocalStorageScript);
        console.log('🔍 SetLocalStorage Result:', result);

        // Nếu chưa xong thì chờ đợt sau reload
        if (result.done) {
          setIsReady(true); // Cho phép nút hoạt động
        } else {
          setIsReady(false); // Chặn thao tác
        }
      } catch (err) {
        console.error('❌ Lỗi SetLocalStorage:', err);
      }
    };

    webview.addEventListener('dom-ready', handleDomReady);

    return () => {
      webview.removeEventListener('dom-ready', handleDomReady);
    };
  }, []);

  return (
    <webview
      id="gate-webview"
      ref={webviewRef}
      src="https://www.gate.com/en/futures/USDT/BTC_USDT"
      className="w-full h-full"
      webpreferences="contextIsolation=false, nodeIntegration=false, webSecurity=false"
      partition="persist:trusted"
      preload={wvPreload}
    />
  );
}
