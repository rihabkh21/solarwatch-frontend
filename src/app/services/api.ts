import { auth } from '../config/firebase';

const API_BASE_URL =
  import.meta.env.VITE_FIREBASE_FUNCTIONS_BASE_URL ||
  `https://europe-west1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/api`;

async function getAccessToken() {
  if (!auth?.currentUser) return null;
  return auth.currentUser.getIdToken();
}

// Helper function to make authenticated API requests
async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = await getAccessToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Request failed: ${response.statusText}`);
  }

  return response.json();
}

export const authApi = {
  async getCurrentUser() {
    return apiRequest('/auth/me');
  },

  async signUp(email: string, password: string, name: string, role: string) {
    return apiRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, role }),
    });
  },
};

// ==================== SENSOR DATA API ====================

export const sensorApi = {
  // POST sensor data (for ESP32)
  async submitSensorData(data: any) {
    return apiRequest('/sensor-data', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // GET latest sensor data
  async getLatestData() {
    return apiRequest('/sensor-data/latest');
  },

  // GET historical data
  async getHistoricalData(hours: number = 24, limit: number = 100) {
    return apiRequest(`/sensor-data/history?hours=${hours}&limit=${limit}`);
  },
};

// ==================== ALERTS API ====================

export const alertsApi = {
  // GET all alerts
  async getAllAlerts() {
    return apiRequest('/alerts');
  },

  // POST create alert
  async createAlert(type: string, severity: string, message: string, sensorData?: any) {
    return apiRequest('/alerts', {
      method: 'POST',
      body: JSON.stringify({ type, severity, message, sensorData }),
    });
  },

  // PUT resolve alert
  async resolveAlert(alertId: string) {
    return apiRequest(`/alerts/${alertId}/resolve`, {
      method: 'PUT',
    });
  },
};

// ==================== STATISTICS API ====================

export const statsApi = {
  // GET system statistics
  async getStats() {
    return apiRequest('/stats');
  },
};

// ==================== ADMIN API ====================

export const adminApi = {
  // GET all users
  async getAllUsers() {
    return apiRequest('/admin/users');
  },

  // DELETE user
  async deleteUser(userId: string) {
    return apiRequest(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  },

  // GET system config
  async getConfig() {
    return apiRequest('/admin/config');
  },

  // PUT update config
  async updateConfig(config: any) {
    return apiRequest('/admin/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },
};

