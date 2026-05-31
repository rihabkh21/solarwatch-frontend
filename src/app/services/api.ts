import { auth } from '../config/firebase';

// URL de base de l'API backend (Firebase Cloud Functions)
// Utilise la variable d'environnement si definie, sinon construit l'URL depuis l'ID du projet
const API_BASE_URL =
  import.meta.env.VITE_FIREBASE_FUNCTIONS_BASE_URL ||
  `https://europe-west1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/api`;

// Recupere le token JWT de l'utilisateur connecte pour authentifier les requetes API
async function getAccessToken() {
  if (!auth?.currentUser) return null;
  return auth.currentUser.getIdToken();
}

// Helper function to make authenticated API requests
// Fonction centrale qui ajoute automatiquement le token Bearer et gere les erreurs HTTP
async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = await getAccessToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Ajout du token d'authentification si l'utilisateur est connecte
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // En cas d'erreur HTTP, tente de lire le message d'erreur du corps de la reponse
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Request failed: ${response.statusText}`);
  }

  return response.json();
}

// Endpoints lies a l'authentification des utilisateurs
export const authApi = {
  // Recupere le profil de l'utilisateur actuellement connecte
  async getCurrentUser() {
    return apiRequest('/auth/me');
  },

  // Cree un nouveau compte utilisateur avec email, mot de passe, nom et role
  async signUp(email: string, password: string, name: string, role: string) {
    return apiRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, role }),
    });
  },
};

// ==================== SENSOR DATA API ====================

// Endpoints lies aux donnees capteurs de l'ESP32
export const sensorApi = {
  // POST sensor data (for ESP32)
  // Recoit et enregistre les mesures envoyees par l'ESP32 toutes les 3 secondes
  async submitSensorData(data: any) {
    return apiRequest('/sensor-data', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // GET latest sensor data
  // Retourne la derniere mesure disponible pour affichage en temps reel
  async getLatestData() {
    return apiRequest('/sensor-data/latest');
  },

  // GET historical data
  // Retourne l'historique des mesures sur une periode donnee (defaut : 24h, limite : 100 entrees)
  async getHistoricalData(hours: number = 24, limit: number = 100) {
    return apiRequest(`/sensor-data/history?hours=${hours}&limit=${limit}`);
  },
};

// ==================== ALERTS API ====================

// Endpoints lies aux alertes generees par les anomalies capteurs
export const alertsApi = {
  // GET all alerts
  // Recupere toutes les alertes (resolues et non resolues)
  async getAllAlerts() {
    return apiRequest('/alerts');
  },

  // POST create alert
  // Cree une nouvelle alerte avec type, severite, message et donnees capteurs optionnelles
  async createAlert(type: string, severity: string, message: string, sensorData?: any) {
    return apiRequest('/alerts', {
      method: 'POST',
      body: JSON.stringify({ type, severity, message, sensorData }),
    });
  },

  // PUT resolve alert
  // Marque une alerte comme resolue via son identifiant unique
  async resolveAlert(alertId: string) {
    return apiRequest(`/alerts/${alertId}/resolve`, {
      method: 'PUT',
    });
  },
};

// ==================== STATISTICS API ====================

// Endpoints lies aux statistiques globales du systeme
export const statsApi = {
  // GET system statistics
  // Retourne les indicateurs cles : energie produite, puissance, rendement, CO2 evite
  async getStats() {
    return apiRequest('/stats');
  },
};

// ==================== ADMIN API ====================

// Endpoints reserves aux administrateurs pour la gestion des utilisateurs et de la configuration
export const adminApi = {
  // GET all users
  // Retourne la liste complete des comptes utilisateurs enregistres
  async getAllUsers() {
    return apiRequest('/admin/users');
  },

  // DELETE user
  // Supprime definitivement un compte utilisateur par son identifiant
  async deleteUser(userId: string) {
    return apiRequest(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  },

  // GET system config
  // Recupere la configuration systeme actuelle (seuils d'alerte, intervalles, etc.)
  async getConfig() {
    return apiRequest('/admin/config');
  },

  // PUT update config
  // Met a jour la configuration systeme avec les nouvelles valeurs fournies
  async updateConfig(config: any) {
    return apiRequest('/admin/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },
};