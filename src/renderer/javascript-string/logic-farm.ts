import { TSide } from "@/types/base.type";
import { TPayloadLeverage } from "@/types/leverage.type";

export const setLocalStorageScript = `
(function () {
  const desiredSettings = {
    "future-order-type-usdt": "market",
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
    "future_no_noty_twap": "false"
  };

  const alreadyReloaded = sessionStorage.getItem("__reloaded_once__");

  const notMatched = Object.entries(desiredSettings).filter(
    ([key, value]) => localStorage.getItem(key) !== value
  );

  if (notMatched.length === 0) {
    console.info("✅ localStorage đã đúng, không cần reload");
    window.ready = true;
    return { done: true, message: "✅ localStorage OK" };
  }

  for (const [key, value] of notMatched) {
    localStorage.setItem(key, value);
  }

  console.warn("⚠️ Đã cập nhật localStorage:", notMatched);

  if (!alreadyReloaded) {
    sessionStorage.setItem("__reloaded_once__", "true");
    console.log("🔄 Reload lại để apply localStorage");

    // Trả về trước khi reload (trong microtask để đảm bảo send xong)
    setTimeout(() => {
      location.reload();
    }, 10);

    return { done: false, message: "🔄 Đang reload sau khi cập nhật localStorage" };
  }

  // Đã reload rồi mà vẫn sai
  return { done: false, message: "❌ localStorage chưa đúng dù đã reload" };
})();
`;

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

export type TCloseOrder = {
    symbol: string;
    side: TSide;
    selector: {
        wrapperPositionBlocks: string;
    };
};
export const closeOrder = (payload: TCloseOrder) => {
    return `
(async () => {
  try {
      const matchSide = '${payload.side}' === 'long' ? 'Long' : 'Short';
      const expectedSymbol = '${payload.symbol}'.replace('_', '');

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
            return '✅ Market button clicked';
          } else {
            throw new Error('Market button not found');
          }
        }
      }

      throw new Error('Position not found for ${payload.symbol} and ${payload.side}');
  } catch (err) {
      console.info('⚠️ closeOrder script error:', err.message || err);
      throw err;
  }
})();
`;
};

export const changeLeverage = (payload: TPayloadLeverage) => {
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
        buttonCloseAll: string;
    };
};
export const clickCloseAll = ({ selector }: TClickCloseAll) => {
    return `
(async () => {
  try {
    const btn = document.querySelector('${selector.buttonCloseAll}');
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
