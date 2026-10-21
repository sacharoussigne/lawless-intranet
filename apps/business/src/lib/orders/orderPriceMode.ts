/** Price typed by hand in an order form, or '' when the field is empty. */
export type OrderPriceInput = number | '';

export type OrderPriceState = { manual: boolean; manualPrice: OrderPriceInput };

/** Value shown in the price field: the typed price, or the catalog total while automatic. */
export function displayedOrderPrice(
  state: OrderPriceState,
  suggestedPrice: number | null,
): OrderPriceInput {
  return state.manual ? state.manualPrice : (suggestedPrice ?? '');
}

/** Typing a price makes it manual; emptying the field goes back to automatic. */
export function typeOrderPrice(value: string | number): OrderPriceState {
  if (value === '' || value == null) return { manual: false, manualPrice: '' };
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? { manual: true, manualPrice: parsed }
    : { manual: false, manualPrice: '' };
}

/** What the order actions receive: the service recomputes the price unless it is manual. */
export function orderPricePayload(state: OrderPriceState): {
  price: number | null;
  priceManual: boolean;
} {
  if (state.manual && state.manualPrice !== '') {
    return { price: state.manualPrice, priceManual: true };
  }
  return { price: null, priceManual: false };
}

export function initialOrderPriceState(order: {
  price: number | null;
  priceManual?: boolean;
}): OrderPriceState {
  return order.priceManual && order.price != null
    ? { manual: true, manualPrice: order.price }
    : { manual: false, manualPrice: '' };
}
