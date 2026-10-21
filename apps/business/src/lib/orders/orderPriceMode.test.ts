import { describe, expect, it } from 'vitest';
import {
  displayedOrderPrice,
  initialOrderPriceState,
  orderPricePayload,
  typeOrderPrice,
} from './orderPriceMode';

describe('orderPriceMode', () => {
  it('shows the catalog total while automatic', () => {
    expect(displayedOrderPrice({ manual: false, manualPrice: '' }, 6)).toBe(6);
    expect(displayedOrderPrice({ manual: false, manualPrice: '' }, null)).toBe('');
    expect(displayedOrderPrice({ manual: true, manualPrice: 10 }, 6)).toBe(10);
  });

  it('turns manual when a price is typed and automatic when emptied', () => {
    expect(typeOrderPrice(12.5)).toEqual({ manual: true, manualPrice: 12.5 });
    expect(typeOrderPrice('')).toEqual({ manual: false, manualPrice: '' });
    expect(typeOrderPrice(0)).toEqual({ manual: false, manualPrice: '' });
  });

  it('sends the price only when it is manual', () => {
    expect(orderPricePayload({ manual: true, manualPrice: 10 })).toEqual({
      price: 10,
      priceManual: true,
    });
    expect(orderPricePayload({ manual: false, manualPrice: '' })).toEqual({
      price: null,
      priceManual: false,
    });
  });

  it('starts from the saved order', () => {
    expect(initialOrderPriceState({ price: 4, priceManual: false })).toEqual({
      manual: false,
      manualPrice: '',
    });
    expect(initialOrderPriceState({ price: 9, priceManual: true })).toEqual({
      manual: true,
      manualPrice: 9,
    });
  });
});
