import { Decimal } from 'decimal.js';

interface CalculateOvertimeParams {
  baseSalary: number;
  workedMinutes: number;
  date: Date;
  holidays: { date: Date; name: string }[];
  hrRule: {
    he_divisor: number;
    he_multiplier_standard: number | Decimal;
    he_multiplier_special: number | Decimal;
    daily_workload_minutes: number;
    tolerance_minutes: number;
  };
  forceFullOvertime?: boolean;
}

export function calculateOvertime({
  baseSalary,
  workedMinutes,
  date,
  holidays,
  hrRule,
  forceFullOvertime = false
}: CalculateOvertimeParams) {
  // Identificação de Domingo ou Feriado
  const isSunday = date.getUTCDay() === 0 || date.getDay() === 0;
  
  // Normalizar datas para comparação (ignorando time)
  const dStr = date.toISOString().substring(0, 10);
  const holiday = holidays.find(h => h.date.toISOString().substring(0, 10) === dStr);

  let activeMultiplier = hrRule.he_multiplier_standard;
  let multiplierReason = "Adicional Padrão (60%)";

  const excessMinutes = workedMinutes - hrRule.daily_workload_minutes;
  let overtimeMinutes = 0;

  if (holiday) {
    activeMultiplier = hrRule.he_multiplier_special;
    multiplierReason = `Adicional 100% Integral (Feriado: ${holiday.name})`;
    overtimeMinutes = workedMinutes; // Feriado paga 100% o dia todo
  } else if (isSunday && forceFullOvertime) {
    activeMultiplier = hrRule.he_multiplier_special;
    multiplierReason = "Adicional 100% Integral (Regra do Último Domingo)";
    overtimeMinutes = workedMinutes; // Último domingo do mês sem folgas paga 100% o dia todo
  } else {
    // Dias normais ou Domingos normais (que não acionam regra integral) pagam apenas sobre o excedente
    if (excessMinutes > hrRule.tolerance_minutes) {
      overtimeMinutes = excessMinutes;
    }
    
    if (isSunday) {
        activeMultiplier = hrRule.he_multiplier_special;
        multiplierReason = "Adicional 100% (Domingo)";
    }
  }

  if (overtimeMinutes <= 0) {
    return {
      total_minutes: 0,
      calculated_value: 0,
      calculation_memory: null
    };
  }

  const multiplier = new Decimal(activeMultiplier);
  const salaryDecimal = new Decimal(baseSalary);
  const divisorDecimal = new Decimal(hrRule.he_divisor);
  
  // Valor da hora = Salario / Divisor
  const hourlyRate = salaryDecimal.dividedBy(divisorDecimal);
  
  // Valor da hora com adicional = ValorHora * Multiplicador
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
      multiplier_reason: multiplierReason,
      workload_minutes: hrRule.daily_workload_minutes
    }
  };
}
