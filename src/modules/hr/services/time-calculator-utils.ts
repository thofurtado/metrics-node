import { TimeClock } from '@prisma/client';

export function calculateWorkedMinutes(timeClock: TimeClock): number {
    let totalMs = 0;

    // Helper para calcular a diferença, lidando com virada de meia-noite (+24h se negativo)
    const getDiff = (start: Date, end: Date) => {
        let diff = end.getTime() - start.getTime();
        if (diff < 0) {
            diff += 24 * 60 * 60 * 1000;
        }
        return diff;
    };

    // Turno 1: Entrada até Início do Intervalo (ou Saída, se não tiver intervalo)
    if (timeClock.clockIn) {
        const endOfTurn1 = timeClock.breakStart || timeClock.clockOut;
        if (endOfTurn1) {
            totalMs += getDiff(timeClock.clockIn, endOfTurn1);
        }
    }

    // Turno 2: Fim do Intervalo até Saída
    if (timeClock.breakEnd && timeClock.clockOut) {
        totalMs += getDiff(timeClock.breakEnd, timeClock.clockOut);
    }

    // Turno Extra: Entrada Extra até Saída Extra
    if (timeClock.extraClockIn && timeClock.extraClockOut) {
        totalMs += getDiff(timeClock.extraClockIn, timeClock.extraClockOut);
    }

    // Retorna minutos arredondando para baixo
    return Math.floor(totalMs / 1000 / 60);
}
