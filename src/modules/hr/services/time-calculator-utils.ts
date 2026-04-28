import { TimeClock } from '@prisma/client';

export function calculateWorkedMinutes(timeClock: TimeClock): number {
    let totalMs = 0;

    // Turno 1: Entrada até Início do Intervalo (ou Saída, se não tiver intervalo)
    if (timeClock.clockIn) {
        const endOfTurn1 = timeClock.breakStart || timeClock.clockOut;
        if (endOfTurn1) {
            totalMs += endOfTurn1.getTime() - timeClock.clockIn.getTime();
        }
    }

    // Turno 2: Fim do Intervalo até Saída
    if (timeClock.breakEnd && timeClock.clockOut) {
        totalMs += timeClock.clockOut.getTime() - timeClock.breakEnd.getTime();
    }

    // Turno Extra: Entrada Extra até Saída Extra
    if (timeClock.extraClockIn && timeClock.extraClockOut) {
        totalMs += timeClock.extraClockOut.getTime() - timeClock.extraClockIn.getTime();
    }

    // Retorna minutos arredondando para baixo
    return Math.floor(totalMs / 1000 / 60);
}
