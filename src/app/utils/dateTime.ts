// Utilitaires pour la gestion des dates et heures en Tunisie
// Fuseau horaire : Africa/Tunis (UTC+1)

// Constantes de localisation utilisees dans toutes les fonctions de formatage
export const TUNISIA_TIMEZONE = 'Africa/Tunis';
export const TUNISIA_LOCALE = 'fr-TN';

/**
 * Formate une date en français tunisien
 */
// Fonction de base utilisee par toutes les autres fonctions de formatage
// Accepte un objet Date ou une chaine ISO et applique le fuseau horaire tunisien
export function formatDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat(TUNISIA_LOCALE, {
    timeZone: TUNISIA_TIMEZONE,
    ...options,
  }).format(dateObj);
}

/**
 * Formate une date complète avec jour, mois, année
 */
// Exemple de sortie : "lundi 21 février 2026"
export function formatFullDate(date: Date | string): string {
  return formatDate(date, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Formate une date courte (JJ/MM/AAAA)
 */
// Exemple de sortie : "21/02/2026"
export function formatShortDate(date: Date | string): string {
  return formatDate(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formate l'heure (HH:MM:SS)
 */
// Le parametre includeSeconds permet d'afficher ou masquer les secondes
export function formatTime(date: Date | string, includeSeconds: boolean = false): string {
  return formatDate(date, {
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
  });
}

/**
 * Formate date + heure
 */
// Combine la date courte et l'heure en une seule chaine
export function formatDateTime(date: Date | string, includeSeconds: boolean = false): string {
  return formatDate(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
  });
}

/**
 * Formate une date relative (il y a 2h, hier, etc.)
 */
// Retourne une chaine lisible selon l'ecart avec l'heure actuelle :
// moins d'une minute, minutes, heures, jours, ou date courte si plus d'une semaine
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "À l'instant";
  if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  
  // Au-dela d'une semaine, affiche la date courte
  return formatShortDate(dateObj);
}

/**
 * Obtient la date/heure actuelle en Tunisie
 */
export function getCurrentTunisiaTime(): Date {
  // Convertit l'heure UTC en heure locale tunisienne via toLocaleString
  const now = new Date();
  const tunisiaTimeString = now.toLocaleString('en-US', { 
    timeZone: TUNISIA_TIMEZONE 
  });
  return new Date(tunisiaTimeString);
}

/**
 * Obtient le timestamp actuel en Tunisie
 */
// Retourne l'heure tunisienne au format ISO 8601
export function getCurrentTunisiaTimestamp(): string {
  return getCurrentTunisiaTime().toISOString();
}

/**
 * Formate pour les graphiques (axe X)
 */
// Adapte le format d'affichage selon la granularite du graphique :
// heure (HH:MM), jour (JJ mois), semaine (JJ mois), mois (mois AAAA)
export function formatChartTime(date: Date | string, granularity: 'hour' | 'day' | 'week' | 'month' = 'hour'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  switch (granularity) {
    case 'hour':
      return formatDate(dateObj, {
        hour: '2-digit',
        minute: '2-digit',
      });
    case 'day':
      return formatDate(dateObj, {
        day: '2-digit',
        month: 'short',
      });
    case 'week':
      return formatDate(dateObj, {
        day: '2-digit',
        month: 'short',
      });
    case 'month':
      return formatDate(dateObj, {
        month: 'short',
        year: 'numeric',
      });
    default:
      return formatTime(dateObj);
  }
}

/**
 * Calcule le début de la journée en Tunisie
 */
// Retourne minuit (00:00:00.000) dans le fuseau horaire tunisien pour la date donnee
export function getStartOfDay(date: Date | string = new Date()): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const tunisiaDate = new Date(dateObj.toLocaleString('en-US', { timeZone: TUNISIA_TIMEZONE }));
  tunisiaDate.setHours(0, 0, 0, 0);
  return tunisiaDate;
}

/**
 * Calcule la fin de la journée en Tunisie
 */
// Retourne 23:59:59.999 dans le fuseau horaire tunisien pour la date donnee
export function getEndOfDay(date: Date | string = new Date()): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const tunisiaDate = new Date(dateObj.toLocaleString('en-US', { timeZone: TUNISIA_TIMEZONE }));
  tunisiaDate.setHours(23, 59, 59, 999);
  return tunisiaDate;
}

/**
 * Obtient l'heure du lever du soleil approximatif en Tunisie (selon la saison)
 */
// Retourne l'heure de lever du soleil sous forme decimale (ex: 5.5 = 05h30)
// Approximation simplifiée pour la Tunisie
// Hiver (Dec-Feb): ~7h30, Été (Jun-Aug): ~5h30, Printemps/Automne: ~6h30
export function getApproximateSunrise(date: Date = new Date()): number {
  const month = date.getMonth();
  if (month >= 5 && month <= 7) return 5.5; // Été
  if (month >= 11 || month <= 1) return 7.5; // Hiver
  return 6.5; // Printemps/Automne
}

/**
 * Obtient l'heure du coucher du soleil approximatif en Tunisie (selon la saison)
 */
// Retourne l'heure de coucher du soleil sous forme decimale (ex: 19.5 = 19h30)
// Approximation simplifiée pour la Tunisie
// Hiver: ~17h30, Été: ~19h30, Printemps/Automne: ~18h30
export function getApproximateSunset(date: Date = new Date()): number {
  const month = date.getMonth();
  if (month >= 5 && month <= 7) return 19.5; // Été
  if (month >= 11 || month <= 1) return 17.5; // Hiver
  return 18.5; // Printemps/Automne
}

/**
 * Vérifie si c'est actuellement le jour en Tunisie
 */
// Compare l'heure actuelle tunisienne avec les heures de lever et coucher du soleil
export function isDayTime(date: Date = new Date()): boolean {
  const hour = parseFloat(formatDate(date, { hour: 'numeric', hour12: false }));
  const sunrise = getApproximateSunrise(date);
  const sunset = getApproximateSunset(date);
  return hour >= sunrise && hour <= sunset;
}

/**
 * Obtient le nom du jour en français
 */
// Exemple de sortie : "lundi"
export function getDayName(date: Date | string): string {
  return formatDate(date, { weekday: 'long' });
}

/**
 * Obtient le nom du mois en français
 */
// Exemple de sortie : "février"
export function getMonthName(date: Date | string): string {
  return formatDate(date, { month: 'long' });
}

/**
 * Calcule la différence en heures entre deux dates
 */
// Retourne la valeur absolue de l'ecart en heures (toujours positif)
export function getHoursDifference(date1: Date | string, date2: Date | string): number {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  return Math.abs(d2.getTime() - d1.getTime()) / 3600000;
}

/**
 * Formate la durée en format lisible (heures, minutes)
 */
// Affiche "Xh Ym" si plus d'une heure, "Xm Ys" si plus d'une minute, "Xs" sinon
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Obtient les heures de production solaire pour aujourd'hui
 */
// Retourne les bornes de la plage de production en heures decimales pour la date donnee
export function getSolarProductionHours(date: Date = new Date()): { start: number; end: number } {
  return {
    start: getApproximateSunrise(date),
    end: getApproximateSunset(date),
  };
}