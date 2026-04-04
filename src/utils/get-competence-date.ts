/**
 * Calculates the "Competence Date" (Business Day) based on a 7:00 AM cutoff.
 * Records made between 00:00 and 07:00 are assigned to the previous calendar day.
 * Returns a Date object representing the midnight of that business day in UTC.
 */
export function getCompetenceDate(timestamp: Date = new Date()): Date {
    // Clone the date to avoid side effects
    const date = new Date(timestamp.getTime());

    // Cutoff at 7:00 AM
    if (date.getHours() < 7) {
        date.setDate(date.getDate() - 1);
    }

    // Return only the date part at UTC midnight (for Prisma @db.Date compatibility)
    return new Date(Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    ));
}
