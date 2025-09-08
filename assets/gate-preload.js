// assets/gate-preload.js
const { webFrame } = require('electron');

const KILL_WS = `
(() => {
  if (window.__WS_NEUTERED__) return;

  class NoopWS extends EventTarget {
    static CONNECTING=0; static OPEN=1; static CLOSING=2; static CLOSED=3;
    readyState=1; url=""; bufferedAmount=0; binaryType="blob";
    constructor(url, protocols){
      super();
      this.url = String(url || "");
      // báo "open" giả để app nghĩ đã kết nối
      queueMicrotask(() => {
        const e = new Event('open');
        try { this.onopen?.(e); } catch {}
        try { this.dispatchEvent(e); } catch {}
      });
    }

    // Tạo method cho phản hồi:
    // - Nếu client gửi { method: 'xxx.subscribe' } -> giữ nguyên.
    // - Nếu client gửi { channel:'futures.tickers', event:'subscribe' } -> ghép thành 'futures.tickers.subscribe'.
    _deriveMethod(msg){
      if (typeof msg?.method === 'string') return msg.method;
      const ev =
        (typeof msg?.event === 'string' && msg.event) ||
        (typeof msg?.header?.event === 'string' && msg.header.event) || '';
      const ch =
        (typeof msg?.channel === 'string' && msg.channel) ||
        (typeof msg?.header?.channel === 'string' && msg.header.channel) || '';
      if (ev && ch) return ch + '.' + ev.toLowerCase();
      // fallback an toàn để không crash .endsWith
      return 'server.ack';
    }

    _fakeReply(msg){
      const id = (msg && typeof msg.id !== 'undefined') ? msg.id : Date.now();
      const method = this._deriveMethod(msg);
      const okFlag = (method.endsWith('subscribe') || method.endsWith('unsubscribe')) ? 'success' : 'ok';
      return {
        id,
        method,          // ⟵ BẮT BUỘC có field này để tránh .endsWith undefined
        result: okFlag,  // nhiều flow check tồn tại result
        code: 0,         // một số nơi check code === 0
        time: Math.floor(Date.now()/1000),
      };
    }

    send(data){
      let msg=null;
      try { msg = (typeof data === 'string') ? JSON.parse(data) : null; } catch {}
      if (msg) {
        const res = this._fakeReply(msg);
        const evt = new MessageEvent('message', { data: JSON.stringify(res) });
        queueMicrotask(() => {
          try { this.onmessage?.(evt); } catch {}
          try { this.dispatchEvent(evt); } catch {}
        });
        return; // nuốt, không gửi lên mạng
      }
      // data không phải JSON -> nuốt
      return;
    }

    close(){
      this.readyState = 3;
      const e = new Event('close');
      try { this.onclose?.(e); } catch {}
      try { this.dispatchEvent(e); } catch {}
    }

    get onopen(){return this._o} set onopen(f){ this._o = (typeof f==='function'?f:null) }
    get onmessage(){return this._m} set onmessage(f){ this._m = (typeof f==='function'?f:null) }
    get onerror(){return this._e} set onerror(f){ this._e = (typeof f==='function'?f:null) }
    get onclose(){return this._c} set onclose(f){ this._c = (typeof f==='function'?f:null) }
  }

  Object.defineProperty(window,'WebSocket',{ value: NoopWS, configurable:true, writable:true });
  if ('MozWebSocket' in window) {
    Object.defineProperty(window,'MozWebSocket',{ value: NoopWS, configurable:true, writable:true });
  }

  window.__WS_NEUTERED__ = true;
})();`;

webFrame.executeJavaScript(KILL_WS).catch(()=>{});
