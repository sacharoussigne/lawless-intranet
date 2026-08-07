export function formatCompanyBankName(company: {
  name: string;
  bankAccountNumber: string | null;
}): string {
  if (company.bankAccountNumber?.trim()) {
    return `[${company.bankAccountNumber.trim()}] ${company.name}`;
  }
  return company.name;
}
