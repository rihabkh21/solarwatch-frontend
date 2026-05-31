import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Link } from 'react-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { usePanels } from '../../contexts/PanelContext';
import { 
  Users, Settings, BarChart3, Shield, Activity,
  AlertTriangle, TrendingUp, Zap, Database, Clock, LayoutGrid,
} from 'lucide-react';

export function AdminPanel() {
  const { panels } = usePanels();
  const [userCount, setUserCount]   = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  // Activites recentes lues depuis la collection Firestore 'activities'
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    // Ecoute en temps reel le nombre total d'utilisateurs enregistres dans Firestore
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUserCount(snap.size);
    });

    // Alertes actives : uniquement celles dont 'resolved' est false
    const unsubAlerts = onSnapshot(
      query(collection(db, 'alerts'), where('resolved', '==', false)),
      (snap) => setAlertCount(snap.size)
    );

    // Activités récentes : limite a 4 entrees pour l'affichage dans le tableau de bord admin
    const unsubActivities = onSnapshot(collection(db, 'activities'), (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .slice(0, 4);
      setActivities(data);
    });

    // Desinscription de tous les ecouteurs Firestore au demontage du composant
    return () => {
      unsubUsers();
      unsubAlerts();
      unsubActivities();
    };
  }, []);

  // Quatre KPI affiches en haut du panneau admin : utilisateurs, alertes, panneaux, performance
  const stats = [
    { label: 'Utilisateurs Actifs',   value: String(userCount),    change: '', icon: Users,         color: 'text-blue-600',   bg: 'bg-blue-50'   },
    { label: 'Alertes Actives',       value: String(alertCount),   change: '', icon: AlertTriangle,  color: 'text-red-600',    bg: 'bg-red-50'    },
    { label: 'Panneaux Surveillés',   value: String(panels.length), change: '', icon: Activity,      color: 'text-green-600',  bg: 'bg-green-50'  },
    { label: 'Performance Système',   value: '98%',                change: '', icon: TrendingUp,     color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  // Raccourcis vers les principales sections de l'administration
  const quickActions = [
    { title: 'Gestion Utilisateurs',    description: 'Créer, modifier ou supprimer des comptes utilisateurs',       icon: Users,      link: '/admin/users',     color: 'from-blue-500 to-blue-600'   },
    { title: 'Gestion des Panneaux',    description: 'Ajouter, configurer et assigner les capteurs par panneau',    icon: LayoutGrid, link: '/admin/panels',    color: 'from-amber-500 to-amber-600' },
    { title: 'Paramètres Système',      description: 'Configurer les seuils d\'alerte et paramètres',              icon: Settings,   link: '/admin/settings',  color: 'from-purple-500 to-purple-600' },
    { title: 'Configuration Matérielle',description: 'Schéma de connexion ESP32 et capteurs',                      icon: Zap,        link: '/admin/hardware',  color: 'from-orange-500 to-orange-600' },
    { title: 'Rapports & Stats',        description: 'Voir les statistiques détaillées et rapports',                icon: BarChart3,  link: '/admin/reports',   color: 'from-green-500 to-green-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Shield className="h-8 w-8 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Panneau Administrateur</h1>
            <p className="text-gray-600 mt-1">Gestion complète du système SolarWatch</p>
          </div>
        </div>
        <Button className="bg-purple-600 hover:bg-purple-700">
          <Zap className="h-4 w-4 mr-2" />
          Actions Rapides
        </Button>
      </div>

      {/* Stats */}
      {/* Grille responsive des quatre KPI principaux du systeme */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      {/* Cartes cliquables redirigeant vers chaque section d'administration */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Actions Rapides</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickActions.map((action, index) => (
            <Link key={index} to={action.link}>
              {/* Effet de survol : ombre augmentee et icone agrandie via group-hover */}
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer group">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg bg-gradient-to-br ${action.color} group-hover:scale-110 transition-transform`}>
                    <action.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 group-hover:text-amber-600 transition-colors">{action.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{action.description}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activités récentes depuis Firestore */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Activités Récentes</h2>
            <Clock className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {/* Message de repli si aucune activite n'est encore enregistree dans Firestore */}
            {activities.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune activité récente</p>
            ) : (
              activities.map((activity, index) => (
                <div key={index} className="flex items-start gap-3 pb-3 border-b last:border-0">
                  <div className="p-2 bg-gray-100 rounded-lg mt-0.5">
                    <Database className="h-4 w-4 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                    <p className="text-xs text-gray-600 mt-1">Par {activity.user}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* System Health */}
        {/* Indicateurs de disponibilite des quatre services Firebase utilises par SolarWatch */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">État du Système</h2>
            <Activity className="h-5 w-5 text-green-500" />
          </div>
          <div className="space-y-4">
            {[
              { label: 'Firebase',     value: 100, color: 'bg-green-500'  },
              { label: 'Firestore',    value: 100, color: 'bg-blue-500'   },
              { label: 'Realtime DB',  value: 100, color: 'bg-purple-500' },
              { label: 'Functions',    value: 100, color: 'bg-orange-500' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="font-medium text-green-600">En ligne</span>
                </div>
                {/* Barre de progression representant le taux de disponibilite du service */}
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-green-800 font-medium">✓ Tous les systèmes Firebase fonctionnent</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
