import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';

interface AlertCardProps {
  severity: 'critique' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  sensor?: string;
}

const severityConfig = {
  critique: {
    icon: AlertCircle,
    badge: 'bg-red-100 text-red-700 border-red-200',
    iconColor: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  warning: {
    icon: AlertTriangle,
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
    iconColor: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  info: {
    icon: Info,
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  success: {
    icon: CheckCircle,
    badge: 'bg-green-100 text-green-700 border-green-200',
    iconColor: 'text-green-600',
    bgColor: 'bg-green-50',
  },
};

export function AlertCard({ severity, title, message, timestamp, sensor }: AlertCardProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <Card className={`p-4 ${config.bgColor} border-l-4 ${severity === 'critique' ? 'border-l-red-600' : severity === 'warning' ? 'border-l-orange-600' : severity === 'info' ? 'border-l-blue-600' : 'border-l-green-600'}`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 mt-0.5 ${config.iconColor}`} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-900">{title}</h4>
            <Badge variant="outline" className={`text-xs ${config.badge}`}>
              {severity.toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm text-gray-700 mb-2">{message}</p>
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span>🕒 {timestamp}</span>
            {sensor && <span>📡 {sensor}</span>}
          </div>
        </div>
      </div>
    </Card>
  );
}

