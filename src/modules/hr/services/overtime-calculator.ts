import { Decimal } from 'decimal.js';

interface CalculateOvertimeParams {
  baseSalary: number;
  workedMinutes: number;
  hrRule: {
    he_divisor: number;
    he_multiplier_standard: number | Decimal;
    daily_workload_minutes: number;
    tolerance_minutes: number;
  };
}

export function calculateOvertime({
  baseSalary,
  workedMinutes,
  hrRule
}: CalculateOvertimeParams) {
  const excessMinutes = workedMinutes - hrRule.daily_workload_minutes;
  let overtimeMinutes = 0;

  // Aplica a tolerância legal (ex: CLT = 10 min)
  if (excessMinutes > hrRule.tolerance_minutes) {
    overtimeMinutes = excessMinutes;
  }

  if (overtimeMinutes <= 0) {
    return {
      total_minutes: 0,
      calculated_value: 0,
      calculation_memory: null
    };
  }

  const multiplier = new Decimal(hrRule.he_multiplier_standard);
  const salaryDecimal = new Decimal(baseSalary);
  const divisorDecimal = new Decimal(hrRule.he_divisor);
  
  // Valor da hora = Salario / Divisor
  const hourlyRate = salaryDecimal.dividedBy(divisorDecimal);
  
  // Valor da hora com adicional = ValorHora * Multiplicador (ex: 1.6)
  const overtimeHourlyRate = hourlyRate.times(multiplier);
  
  // Valor do minuto com adicional
  const overtimeMinuteRate = overtimeHourlyRate.dividedBy(60);

  // Valor total de hora extra no dia
  const calculatedValue = overtimeMinuteRate.times(overtimeMinutes);

  return {
    total_minutes: overtimeMinutes,
    calculated_value: calculatedValue.toDecimalPlaces(2).toNumber(),
    calculation_memory: {
      base_salary: baseSalary,
      divisor: hrRule.he_divisor,
      hourly_rate: hourlyRate.toDecimalPlaces(2).toNumber(),
      multiplier: multiplier.toNumber(),
      workload_minutes: hrRule.daily_workload_minutes
    }
  };
}
