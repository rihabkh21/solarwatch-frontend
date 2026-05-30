import { useState, useEffect } from 'react';

/**
 * Hook personnalisé pour obtenir l'heure actuelle qui se met à jour automatiquement
 * @param updateInterval - Intervalle de mise à jour en millisecondes (défaut: 1000ms)
 */
export function useCurrentTime(updateInterval: number = 1000) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, updateInterval);

    return () => clearInterval(timer);
  }, [updateInterval]);

  return currentTime;
}
