import { useState, useEffect } from 'react';

/**
 * Hook personnalisé pour obtenir l'heure actuelle qui se met à jour automatiquement
 * @param updateInterval - Intervalle de mise à jour en millisecondes (défaut: 1000ms)
 */
export function useCurrentTime(updateInterval: number = 1000) {
  // Etat initialise a l'heure actuelle au moment du premier rendu
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Cree un intervalle qui met a jour l'heure a chaque cycle defini par updateInterval
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, updateInterval);

    // Nettoyage de l'intervalle quand le composant est demonte pour eviter les fuites memoire
    return () => clearInterval(timer);
  }, [updateInterval]); // Se relance uniquement si l'intervalle change

  // Retourne l'objet Date mis a jour en temps reel
  return currentTime;
}