/**
 * Serviço puro de cálculo da data de vencimento da fatura do cartão de crédito.
 *
 * Regras:
 * - Se dia_compra < dia_fechamento  → fatura do próximo mês
 * - Se dia_compra >= dia_fechamento → fatura de dois meses à frente
 * - Se o vencimento cair em sábado, domingo ou feriado → avança para o próximo dia útil
 */

export interface CreditCardDueDateInput {
  closing_day: number;
  due_day: number;
}

export interface CreditCardDueDateResult {
  due_date: Date;
  /** Representa o mês da fatura em formato "YYYY-MM", útil para rastreio */
  billing_month: string;
}

/**
 * Verifica se uma data é dia útil (não é sábado, domingo ou feriado).
 */
function isBusinessDay(date: Date, holidayStrings: string[]): boolean {
  const dow = date.getDay(); // 0 = Domingo, 6 = Sábado
  if (dow === 0 || dow === 6) return false;
  const dateStr = toDateStr(date);
  return !holidayStrings.includes(dateStr);
}

/** Formata uma Date para "YYYY-MM-DD" sem dependência de timezone */
function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Avança a data até o próximo dia útil (inclusive o próprio dia, se já for útil).
 */
function nextBusinessDay(date: Date, holidayStrings: string[]): Date {
  const result = new Date(date);
  while (!isBusinessDay(result, holidayStrings)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

/**
 * Calcula a data de vencimento da fatura com base na data da compra e nas
 * configurações do cartão.
 *
 * @param purchaseDate  Data da compra (data de emissão da despesa)
 * @param card          Configurações do cartão (dia de fechamento e vencimento)
 * @param holidays      Lista de feriados como strings "YYYY-MM-DD"
 */
export function calculateCreditCardDueDate(
  purchaseDate: Date,
  card: CreditCardDueDateInput,
  holidays: string[] = []
): CreditCardDueDateResult {
  const purchaseDay = purchaseDate.getDate();
  const purchaseMonth = purchaseDate.getMonth(); // 0-indexed
  const purchaseYear = purchaseDate.getFullYear();

  // 1. Determina o ano e mês em que a fatura fecha
  let closingMonth = purchaseMonth;
  let closingYear = purchaseYear;

  if (purchaseDay >= card.closing_day) {
    closingMonth += 1;
    if (closingMonth > 11) {
      closingMonth = 0;
      closingYear += 1;
    }
  }

  // 2. Determina o ano e mês em que a fatura vence
  let billingMonth = closingMonth;
  let billingYear = closingYear;

  if (card.due_day <= card.closing_day) {
    billingMonth += 1;
    if (billingMonth > 11) {
      billingMonth = 0;
      billingYear += 1;
    }
  }

  // Garante que o due_day não exceda os dias disponíveis no mês de vencimento
  const daysInMonth = new Date(billingYear, billingMonth + 1, 0).getDate();
  const effectiveDueDay = Math.min(card.due_day, daysInMonth);

  const baseDueDate = new Date(billingYear, billingMonth, effectiveDueDay, 12, 0, 0, 0);

  // Ajustar para o próximo dia útil caso o vencimento caia em feriado/fim de semana
  const finalDueDate = nextBusinessDay(baseDueDate, holidays);

  const billingMonthStr = `${billingYear}-${String(billingMonthNormalized + 1).padStart(2, '0')}`;

  return {
    due_date: finalDueDate,
    billing_month: billingMonthStr
  };
}
