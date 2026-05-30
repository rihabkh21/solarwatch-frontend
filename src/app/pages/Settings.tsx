import { Card } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../contexts/AuthContext';
import { Database, Cloud } from 'lucide-react';
import { toast } from 'sonner';

export function Settings() {
  const { useFirebaseAuth, toggleFirebaseAuth } = useAuth();

  const handleToggleFirebase = () => {
    toggleFirebaseAuth();
    toast.success(
      useFirebaseAuth
        ? 'Mode Local activé'
        : 'Firebase activé'
    );
  };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-sm text-gray-500 mt-1">Configuration système</p>
      </div>

      {/* Backend Configuration */}
      <Card className="p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center">
            <Database className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Backend</h3>
            <p className="text-sm text-gray-600">Source de données ESP32</p>
          </div>
        </div>

        {/* Firebase Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <Cloud className={`h-5 w-5 ${useFirebaseAuth ? 'text-orange-500' : 'text-gray-400'}`} />
            <div>
              <p className="font-medium">Firebase</p>
              <p className="text-xs text-gray-500">
                {useFirebaseAuth ? 'Données temps réel — ESP32 connecté' : 'Désactivé — mode simulation'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={useFirebaseAuth ? 'default' : 'outline'}
              className={useFirebaseAuth ? 'bg-green-500' : ''}
            >
              {useFirebaseAuth ? 'Actif' : 'Inactif'}
            </Badge>
            <Switch
              checked={useFirebaseAuth}
              onCheckedChange={handleToggleFirebase}
            />
          </div>
        </div>

      </Card>

    </div>
  );
}
