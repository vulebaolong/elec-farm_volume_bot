import { TSide } from "@/types/base.type";
import { TUiSelectorOrder } from "@/types/bot.type";
import { TPayloadLeverage } from "@/types/leverage.type";

// "future-order-type-usdt": "market",
export const setLocalStorageScript = `(function () {
  try {
    var desiredSettings = {
      "future-order-type-usdt": "prolimit",
      "similar.introduction": "false",
      "f-usdt-unit-type-pro": "unit",
      "future_no_noty_all_orders": "false",
      "future_no_noty_all_positions": "false",
      "future_no_noty_chaseOrder": "false",
      "future_no_noty_chase_limit": "false",
      "future_no_noty_iceberg_pro": "false",
      "future_no_noty_limit": "false",
      "future_no_noty_market": "false",
      "future_no_noty_orders_fill": "false",
      "future_no_noty_reverse": "false",
      "future_no_noty_scaled": "false",
      "future_no_noty_stop": "false",
      "future_no_noty_trail": "false",
      "future_no_noty_trans_prompt": "false",
      "future_no_noty_trigger_reverse": "false",
      "future_no_noty_twap": "false",
      "future_clear_amount_after_order": 0,
      "show_favorites": 0,
      "custom_default_trade_show_layout_1.4.1856": {
        "charts": false,
        "marketList": false,
        "orderPanel": true,
        "entrustInfo": false,
        "trading": true,
        "assets": false,
        "topMovers": false
      },
      "trade_event_setting": 0,
      "PRO_FUTURE_SAVE_CURRENCY_TITLES": ["fullHoursSettle"],
    };

    function toStore(v) {
      if (v === null || v === undefined) return '';
      var t = typeof v;
      if (t === 'string') return v;
      if (t === 'number' || t === 'boolean') return String(v);
      // array / object
      try { return JSON.stringify(v); } catch(_) { return String(v); }
    }

    var changed = [];
    for (var k in desiredSettings) {
      if (!Object.prototype.hasOwnProperty.call(desiredSettings, k)) continue;
      var want = toStore(desiredSettings[k]);
      var cur  = localStorage.getItem(k);
      if (cur !== want) {
        localStorage.setItem(k, want);
        changed.push([k, cur, want]);
      }
    }

    console.info('[localStorage] updated:', changed.length, changed);
    window.ready = true;
    return { done: true, updated: changed.length };
  } catch (e) {
    console.error('[localStorage] error:', e);
    return { done: false, error: String(e) };
  }
})();`;

export type TOpenOrder = {
    symbol: string;
    size: string;
    selector: {
        inputAmount: string;
        buttonLong: string;
    };
};
export const openOrder = (payload: TOpenOrder) => {
    return `
window.log = []
window.state = Object.assign(window.state || {}, {...window.state, symbol: '${payload.symbol}', size: '${payload.size}' });

(async () => {
  try {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));

      const input = document.querySelector('${payload.selector.inputAmount}');
      if (!input) throw new Error('Input not found');

      input.focus();

      const nativeInputValueSetter = Object.getOwnPropertyDescriptor( window.HTMLInputElement.prototype,'value')?.set;

      // clear input
      nativeInputValueSetter?.call(input, '');


      // set value
      nativeInputValueSetter?.call(input, window.state.amount);
      log.push({ message: 'Set input value', data: window.state.amount });
      console.info({ message: 'Set input value', data: window.state.amount });


      input.dispatchEvent(new Event('input', { bubbles: true }));
      log.push({ message: 'Input value', data: input.value });
      console.info({ message: 'Input value', data: input.value });


      const btn = document.querySelector('${payload.selector.buttonLong}');
      if (!btn) {
        console.info({ message: 'Buy button not found', data: null });
        throw new Error('Buy button not found');
      }

      btn.removeAttribute('disabled');
      btn.click();
      log.push({ message: 'Buy button clicked', data: null });

      return log;
  } catch (err) {
      console.info('⚠️ openOrder script error:', err.message || err);
      throw err;
  }
})();
`;
};

export type TOpenOrderPostOnly = {
    symbol: string;
    price: string; // giá đã làm tròn đúng tick
    size: string; // số lượng/amount
    reduce_only: boolean;
    selector: {
        inputPrice: string;
        inputPosition: string;
        buttonLong: string;
    };
};

export const openOrderPostOnly = (payload: TOpenOrderPostOnly) => {
    return `
window.log = [];
window.state = Object.assign(window.state || {}, {
  ...window.state,
  symbol: ${JSON.stringify(payload.symbol)},
  pricePayload: '${payload.price}',
  size: JSON.stringify(${payload.size}),
  reduce_only: ${payload.reduce_only},
});

(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // hàm set value an toàn cho input controlled (React/Vue)
  const setValue = (el, value) => {
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    const setter = desc && desc.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  try {
    const inputPrice = document.querySelector(${JSON.stringify(payload.selector.inputPrice)});
    if (!inputPrice) throw new Error('inputPrice not found');

    const inputPosition = document.querySelector(${JSON.stringify(payload.selector.inputPosition)});
    if (!inputPosition) throw new Error('inputPosition not found');

    const btn = document.querySelector(${JSON.stringify(payload.selector.buttonLong)});
    if (!btn) throw new Error('Buy button not found');

    // --- set PRICE ---
    inputPrice.focus();
    // clear
    setValue(inputPrice, '');
    // set price
    setValue(inputPrice, window.state.price);
    log.push({ message: 'Set inputPrice value', data: window.state.price });
    console.info({ message: 'Set inputPrice value', data: window.state.price });

    await sleep(10);

    // --- set AMOUNT/POSITION ---
    inputPosition.focus();
    // clear
    setValue(inputPosition, '');
    // set amount
    setValue(inputPosition, window.state.amount);
    log.push({ message: 'Set inputPosition value', data: window.state.amount });
    console.info({ message: 'Set inputPosition value', data: window.state.amount });

    await sleep(10);

    // --- click BUY ---
    btn.removeAttribute('disabled');
    btn.click();
    log.push({ message: 'Buy button clicked', data: null });

    return log;
  } catch (err) {
    console.info('⚠️ openOrder script error:', err?.message || err);
    throw err;
  }
})();
`;
};

export type TClickMarketPosition = {
    symbol: string;
    side: TSide;
    selector: {
        wrapperPositionBlocks: string;
        buttonTabPosition: string;
    };
};
export const createCodeStringClickMarketPosition = (payload: TClickMarketPosition) => {
    return `
(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  try {
      const matchSide = '${payload.side}' === 'long' ? 'Long' : 'Short';
      const expectedSymbol = '${payload.symbol}'.replace('_', '');

      const buttonTabPosition = document.querySelector("${payload.selector.buttonTabPosition}");
      if (!buttonTabPosition) throw new Error('buttonTabPosition not found');

      buttonTabPosition.click();

      await sleep(100);

      const wrapper = document.querySelector("${payload.selector.wrapperPositionBlocks}");
      if (!wrapper) throw new Error('Wrapper not found');

      const positionBlocks = Array.from(wrapper.children);
      if (positionBlocks.length === 0) {
        throw new Error('No open positions found');
      }

      for (const block of positionBlocks) {
        const labelText = block.innerText.slice(0, 30);
        if (labelText.includes(matchSide) && labelText.includes(expectedSymbol)) {
          const marketBtn = block.querySelectorAll('button')[1];
          if (marketBtn) {
            marketBtn.click();
            return { ok: true, data: true, error: null };
          } else {
            throw new Error('Market button not found');
          }
        }
      }

      throw new Error('Position not found for ${payload.symbol} and ${payload.side}');
  } catch (err) {
      return { ok: false, data: null, error: err };
  }
})();
`;
};

export const createCodeStringchangeLeverage = (payload: TPayloadLeverage) => {
    return `
(async () => {
try {
     const res = await fetch('/apiw/v2/futures/usdt/positions/${payload.symbol}/leverage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ leverage: '${payload.leverage}' }),
    })
    const data = await res.json();
    console.info("📤 leverage ${payload.symbol} : ${payload.leverage} thành công", data)
    return data
} catch (error) {
    console.info('❌ Lỗi khi gọi lại leverage API', error);
}
})();
`;
};

export type TClickCloseAll = {
    selector: {
        buttonCloseAllPosition: string;
    };
};
export const clickCloseAll = ({ selector }: TClickCloseAll) => {
    return `
(async () => {
  try {
    const btn = document.querySelector('${selector.buttonCloseAllPosition}');
    if (!btn) throw new Error('❌ Close All button not found');

    btn.click();
    return '✅ Close All button clicked';
  } catch (err) {
    console.info('⚠️ clickCloseAll script error:', err.message || err);
    throw err;
  }
})();
`;
};

export const createCodeStringGetOrderOpens = () => {
    return `
(async () => {
  try {
    const dataDraw = await fetch("https://www.gate.com/apiw/v2/futures/usdt/orders?contract=&status=open")
    const data = await dataDraw.json()
    console.info({createCodeStringGetOrderOpens: data})
    return data;
  } catch (err) {
    console.info('⚠️ createCodeStringGetOrderOpens script error:', err.message || err);
    throw err;
  }
})();
`;
};

export const createCodeStringGetPositions = () => {
    return `
(async () => {
  try {
    const dataDraw = await fetch("https://www.gate.com/apiw/v2/futures/usdt/positions")
    const data = await dataDraw.json()
    console.info({getPosition: data})
    return data;
  } catch (err) {
    console.info('⚠️ createCodeStringGetPositions script error:', err.message || err);
    throw err;
  }
})();
`;
};

/**
 * contract: BTC_USDT (dùng dấu gạch dưới _)
 */
export const createCodeStringGetMyTrades = (contract?: string, start_time?: number, role?: "taker" | "maker") => {
    return `
(async () => {
  try {
    const dataDraw = await fetch("https://www.gate.com/apiw/v2/futures/usdt/my_trades?contract=${contract ? contract : ""}&limit=50&offset=0&start_time=${start_time ? start_time : ""}&role=${role ? role : ""}")
    const data = await dataDraw.json()
    console.info({createCodeStringGetMyTrade: data})
    return data;
  } catch (err) {
    console.info('⚠️ createCodeStringGetMyTrade script error:', err.message || err);
    throw err;
  }
})();
`;
};

export type TCreateCodeStringClickTabOpenOrder = {
    buttonTabOpenOrder: string;
};
export const createCodeStringClickTabOpenOrder = (payload: TCreateCodeStringClickTabOpenOrder) => {
    return `
(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  try {
      const buttonTabOpenOrder = document.querySelector("${payload.buttonTabOpenOrder}");
      if (!buttonTabOpenOrder) throw new Error('buttonTabOpenOrder not found');

      buttonTabOpenOrder.click();

      await sleep(100);

      return { ok: true, data: true, error: null };
  } catch (err) {
      return { ok: false, data: null, error: String(err && err.message || err) };
  }
})();
`;
};

type TCreateCodeStringClickCancelAllOpen = {
    contract: string;
    tableOrderPanel: string;
};

/**
 * contract: FLOCKUSDT (không có dấu ở giữa)
 */
export const createCodeStringClickCancelAllOpen = ({ contract, tableOrderPanel }: TCreateCodeStringClickCancelAllOpen) => {
    return `
(() => {
  try {
    const NO_WORDS = new Set(["no","否","không","нет","non","não","tidak","いいえ","لا","ні"]);

    const table = document.querySelector('${tableOrderPanel}');
    if (!table) throw new Error('❌ Orders table not found: table.trade__table');
    const rows = table.querySelectorAll('tbody tr[role="row"], tbody tr');

    let scanned = 0, clicked = 0, skipped = 0;
    for (const row of rows) {
      scanned++;

      // 1) Lấy CONTRACT ở cột đầu (normalize về "SYMBOLUSDT")
      const contractNorm = row.innerText.split('\\n').at(0)

      // Nếu có chỉ định contract mà khác thì bỏ qua
      if (contractNorm !== "${contract}") { skipped++; continue; }

      // 2) Kiểm tra Reduce-Only = No (đa ngôn ngữ)
      //    Tìm trong các cell của hàng xem có cell nào text đúng 1 trong số "No"/dịch của nó
      const textReduceOnly = (Array.from(row.children).at(8).textContent || "").trim().toLowerCase();
      if (!NO_WORDS.has(textReduceOnly)) { skipped++; continue; }

      // 3) Tìm nút Cancel trong cột Action và click
      //    Ưu tiên button có chữ "Cancel" (case-insensitive); nếu không có thì lấy button cuối cùng trong ô cuối.
      let btn = Array.from(row.children).at(-1).querySelectorAll("button")[1];

      if (btn) {
        btn.click();
        clicked++;
      } else {
        skipped++;
      }
    }

      return { ok: true, data: { scanned, clicked, skipped, contract: "${contract}" }, error: null };
  } catch (err) {
      return { ok: false, data: null, error: err };
  }
})();
`;
};

/**
 * contract: PENGU_USDT
 */
export const createCodeStringGetBidsAsks = (contract: string, limit: number | undefined = 10) => {
    return `
(async () => {
  try {
    const dataDraw = await fetch("https://www.gate.com/apiw/v2/futures/usdt/order_book?limit=${limit}&contract=${contract}")
    const data = await dataDraw.json()
    console.info({createCodeStringGetBidsAsks: data})
    return data;
  } catch (err) {
    console.info('⚠️ createCodeStringGetBidsAsks script error:', err.message || err);
    throw err;
  }
})();
`;
};

export const createCodeStringClickOrder = (selector: TUiSelectorOrder) => {
    return `
(async () => {
  // const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  let log = [];

  // hàm set value an toàn cho input controlled (React/Vue)
  const setValue = (el, value) => {
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    const setter = desc && desc.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  try {
    const inputPrice = document.querySelector(${JSON.stringify(selector.inputPrice)});
    if (!inputPrice) throw new Error('inputPrice not found');

    const inputPosition = document.querySelector(${JSON.stringify(selector.inputPosition)});
    if (!inputPosition) throw new Error('inputPosition not found');

    const btn = document.querySelector(${JSON.stringify(selector.buttonLong)});
    if (!btn) throw new Error('Buy button not found');

    // --- set PRICE ---
    inputPrice.focus();
    
    // setValue(inputPrice, ''); // clear
    
    setValue(inputPrice, '100'); // set price
    log.push({ message: 'Set inputPrice value', data: '100' });

    // --- set AMOUNT/POSITION ---
    inputPosition.focus();
    
    // setValue(inputPosition, ''); // clear
    
    setValue(inputPosition, '1'); // set amount
    log.push({ message: 'Set inputPosition value', data: '1' });

    // --- click BUY ---
    btn.removeAttribute('disabled');
    btn.click();
    log.push({ message: 'Buy button clicked', data: null });

    return { ok: true, data: log, error: null };
  } catch (err) {
    return { ok: false, data: null, error: String(err && err.message || err) };
  }
})();
`;
};

export const codeStringKillMantineToasts = `
(function () {
  try {
    if (window.__killMantineToasts) { 
      // console.log('mantine-toasts: already active'); 
      return; 
    }

    // 1) CSS: ẩn toàn bộ notifications của Mantine
    var style = document.createElement('style');
    style.id = '__kill_mantine_toasts_css__';
    style.textContent = [
      '.mantine-Notification-root,',
      '[class*="mantine-Notification-root"],',
      '[class*="mantine-Notification-"],',
      // container Gate bọc Mantine (để chắc ăn):
      '[data-pos][style*="--gui-notification-base-zIndex"]',
      '{display:none!important;visibility:hidden!important;pointer-events:none!important;}'
    ].join(' ');
    document.documentElement.appendChild(style);

    // 2) Observer: xóa mọi node toast mới sinh ra
    var SEL = '.mantine-Notification-root,[class*="mantine-Notification-root"],[class*="mantine-Notification-"]';
    var mo = new MutationObserver(function(muts){
      for (var i=0;i<muts.length;i++){
        var nodes = muts[i].addedNodes || [];
        for (var j=0;j<nodes.length;j++){
          var n = nodes[j];
          if (!n || n.nodeType !== 1) continue;
          var el = (n.matches && n.matches(SEL)) ? n : (n.querySelector ? n.querySelector(SEL) : null);
          if (el) try { el.remove(); } catch(e) {}
        }
      }
    });
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch(e) {}

    // Expose handle để bật lại khi cần
    window.__killMantineToasts = {
      off: function(){
        try { mo.disconnect(); } catch(e) {}
        try { var s = document.getElementById('__kill_mantine_toasts_css__'); if (s) s.remove(); } catch(e) {}
        try { delete window.__killMantineToasts; } catch(e) {}
        console.log('mantine-toasts: restored');
      }
    };

    // console.log('mantine-toasts: suppressed (call __killMantineToasts.off() to restore)');
  } catch (e) { 
    // console.error('mantine-toasts error:', e); 
  }
})();
`;

export type TClickClearAll = {
    buttonTabPosition: string;
    buttonCloseAllPosition: string;

    buttonTabOpenOrder: string;
    buttonCloseAllOpenOrder: string;
};

export const createCodeStringClickClearAll = (payload: TClickClearAll) => {
    return `
(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
        // 1) Clear All Position
        const buttonTabPosition = document.querySelector("${payload.buttonTabPosition}");
        if (!buttonTabPosition) throw new Error("buttonTabPosition not found");
        buttonTabPosition.click();

        await wait(120);

        const buttonCloseAllPosition = document.querySelector("${payload.buttonCloseAllPosition}");
        if (buttonCloseAllPosition) buttonCloseAllPosition.click();

        await wait(120);

        // 2) Clear All Open Orders
        const buttonTabOpenOrder = document.querySelector("${payload.buttonTabOpenOrder}");
        if (!buttonTabOpenOrder) throw new Error("buttonTabOpenOrder not found");
        buttonTabOpenOrder.click();

        await wait(120);

        const buttonCloseAllOpenOrder = document.querySelector("${payload.buttonCloseAllOpenOrder}");
        if (buttonCloseAllOpenOrder) buttonCloseAllOpenOrder.click();

        await wait(120);

        return { ok: true, data: true, error: null };
    } catch (error) {
        return { ok: false, data: null, error: String(error && error.message ? error.message : error) };
    }
})();
`;
};

