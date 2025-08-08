window.state = {
  amount: '12',
  symbol: 'BTC_USDT',
  size: '1',
  cross_leverage_limit: '10',
};
window.log = [];

(() => {
  if (window.__WV_PATCHED__) return;
  window.__WV_PATCHED__ = true;

  const relay = (payload) => {
    try {
      window.dispatchEvent(new CustomEvent('__WV_API__', { detail: payload }));
    } catch {}
  };

  // ---- Helpers ----
  // Giới hạn độ dài chuỗi về tối đa n ký tự (mặc định 4096)
  const clamp = (s, n = 4096) => (typeof s === 'string' ? s.slice(0, n) : s);
  // Chuyển giá trị thành JSON string an toàn:
  // - Nếu stringify được ⇒ trả về chuỗi JSON
  // - Nếu lỗi (có vòng tham chiếu, v.v.) ⇒ fallback sang String(v)
  const tryJSON = (v) => {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  };
  const logInfo = (message, data) => {
    const entry = { message, data };
    console.info(entry);
    window.log.push(entry);
  };
  const handlePayloadModification = (data, dataModify) => {
    if (data?.order_type === 'market') {
      console.info({ 'Lệnh thanh lý market bỏ qua': data });
      return data;
    }

    console.info({ '🛠️ Payload trước khi sửa': data });
    const updated = {
      ...data,
      ...dataModify,
    };
    console.info({ '🛠️ Payload sau khi sửa': updated });
    return updated;
  };
  const isMatchAPI = (url, method, rules = []) => {
    const normUrl = url.toLowerCase();
    const normMethod = method.toUpperCase();

    return rules.some((rule) => {
      const ruleUrl = rule.url.toLowerCase();
      const ruleMethod = rule.method.toUpperCase();
      return normUrl === ruleUrl && normMethod === ruleMethod;
    });
  };

  const apiRules = [
    { url: '/apiw/v2/futures/usdt/accounts', method: 'GET' },
    { url: '/apiw/v2/futures/usdt/positions', method: 'GET' },
    { url: '/apiw/v2/futures/usdt/orders', method: 'POST' },
  ];

  // ---- Patch XMLHttpRequest ----
  if (window.XMLHttpRequest && !XMLHttpRequest.prototype.__wv_patched) {
    XMLHttpRequest.prototype.__wv_patched = true;

    const XO = XMLHttpRequest.prototype.open;
    const XS = XMLHttpRequest.prototype.send;
    const XH = XMLHttpRequest.prototype.setRequestHeader;

    // thu thập request headers nếu trang có set
    XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
      this.__wv = this.__wv || {};
      (this.__wv.reqHeaders || (this.__wv.reqHeaders = {}))[k] = v;
      return XH.apply(this, arguments);
    };

    XMLHttpRequest.prototype.open = function (
      method,
      url,
      async = true,
      ...rest
    ) {
      this.__wv = {
        method,
        url,
        async,
        start: Date.now(),
        reqHeaders: (this.__wv && this.__wv.reqHeaders) || {},
      };
      return XO.call(this, method, url, async, ...rest);
    };

    XMLHttpRequest.prototype.send = function (bodyRaw) {
      const info = this.__wv || (this.__wv = {});
      const { url, method } = info;
      let body = bodyRaw;
      info.requestBody = body;

      // ====== GẮN listener để log response ======
      const onLoadEnd = () => {
        try {
          if (isMatchAPI(url, method, apiRules)) {
            // đọc response body (nếu được phép)
            let bodyPreview = '';
            const rt = this.responseType;
            if (rt === '' || rt === 'text' || typeof rt === 'undefined') {
              bodyPreview = this.responseText;
            } else if (rt === 'json') {
              console.info(2);
              bodyPreview = clamp(tryJSON(this.response));
            } else if (rt === 'document') {
              console.info(3);
              bodyPreview = '[document]';
            } else if (rt === 'arraybuffer' && this.response) {
              console.info(4);
              // encode 2KB đầu cho nhẹ
              const bytes = new Uint8Array(this.response).slice(0, 2048);
              let bin = '';
              for (let i = 0; i < bytes.length; i++)
                bin += String.fromCharCode(bytes[i]);
              bodyPreview = 'base64:' + btoa(bin);
            } else if (rt === 'blob' && this.response) {
              console.info(5);
              bodyPreview = '[blob]';
            } else {
              console.info(5);
              bodyPreview = '[' + (rt || 'unknown') + ']';
            }

            // response headers (string kiểu raw)
            const resHeadersRaw =
              typeof this.getAllResponseHeaders === 'function'
                ? this.getAllResponseHeaders()
                : '';

            relay({
              type: 'xhr',
              url: info.url,
              method: String(info.method || 'GET').toUpperCase(),
              status: this.status,
              durationMs: Date.now() - (info.start || Date.now()),
              reqHeaders: info.reqHeaders || {},
              requestBodyPreview:
                typeof info.requestBody === 'string'
                  ? clamp(info.requestBody)
                  : info.requestBody
                    ? '[non-text]'
                    : '',
              resHeadersRaw,
              bodyPreview,
            });
          }
        } catch (e) {
          relay({ type: 'xhr', error: String(e) });
        } finally {
          this.removeEventListener('loadend', onLoadEnd);
        }
      };
      this.addEventListener('loadend', onLoadEnd);

      // ====== SỬA BODY TRƯỚC KHI GỬI ======
      if (url === '/apiw/v2/futures/usdt/orders' && method === 'POST') {
        try {
          if (typeof body === 'string') {
            const parsed = JSON.parse(body);
            const modified = handlePayloadModification(parsed, {
              size: state.size,
              contract: state.symbol,
            });
            body = JSON.stringify(modified);
          } else {
            console.info({ '⚠️ Body không phải JSON string': null });
          }
        } catch (e) {
          console.info({ '❌ JSON parse error': e });
        }
      }
      if (
        url === '/apiw/v2/futures/usdt/positions/BTC_USDT/leverage-tam-tat' &&
        method === 'POST'
      ) {
        try {
          if (typeof body === 'string') {
            const parsed = JSON.parse(body);
            const modified = handlePayloadModification(parsed, {
              cross_leverage_limit: window.state.cross_leverage_limit,
            });
            body = JSON.stringify(modified);
          } else {
            console.info({ '⚠️ Body không phải JSON string': null });
          }
        } catch (e) {
          console.info({ '❌ JSON parse error': e });
        }
      }

      return XS.call(this, body);
    };
  }

  relay({ type: 'ready', href: location.href, ts: Date.now() });
})();
