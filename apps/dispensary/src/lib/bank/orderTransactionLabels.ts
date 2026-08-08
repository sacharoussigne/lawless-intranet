import { formatCompanyBankName } from '@/lib/bank/companyName';

export function resolveBankTransactionTypeForOrder(
  orderType: 'INCOMING' | 'OUTGOING',
): 'TRANSFER_IN' | 'TRANSFER_OUT' {
  // Incoming order = we pay the supplier (money out). Outgoing = we get paid (money in).
  return orderType === 'INCOMING' ? 'TRANSFER_OUT' : 'TRANSFER_IN';
}

export function getBankTransactionTypeLabelForOrder(
  orderType: 'INCOMING' | 'OUTGOING',
): string {
  return orderType === 'INCOMING'
    ? 'Paiement fournisseur (transfert sortant)'
    : 'Encaissement client (transfert entrant)';
}

export function resolveBankTransactionNameForOrder(order: {
  name: string;
  company?: { name: string; bankAccountNumber: string | null } | null;
  individualCustomer?: { name: string } | null;
}): string {
  if (order.company) {
    return formatCompanyBankName(order.company);
  }
  if (order.individualCustomer?.name?.trim()) {
    return order.individualCustomer.name.trim();
  }
  return order.name;
}
