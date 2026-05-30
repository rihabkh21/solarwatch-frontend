import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { LucideIcon } from 'lucide-react';

interface Metric {
  label: string;
  value: string;
  status?: 'normal' | 'warning' | 'error';
  icon?: LucideIcon | null;
}

interface MetricCardProps {
  name: string;
  description: string;
  interface: string;
  icon: LucideIcon;
  color: string;
  metrics: Metric[];
}

const colorClasses = {
  red: 'bg-red-500',
  yellow: 'bg-yellow-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  green: 'bg-green-500',
};

export function MetricCard({ name, description, interface: iface, icon: Icon, color, metrics }: MetricCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-start gap-4 mb-4">
        <div className={`h-12 w-12 rounded-lg ${colorClasses[color as keyof typeof colorClasses] || 'bg-gray-500'} flex items-center justify-center`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{name}</h3>
          <p className="text-sm text-gray-600">{description}</p>
          <Badge variant="outline" className="mt-2 text-xs">{iface}</Badge>
        </div>
      </div>

      <div className="space-y-3">
        {metrics.map((metric, idx) => (
          <div key={idx} className="flex items-center justify-between py-2 border-t">
            <div className="flex items-center gap-2">
              {metric.icon && <metric.icon className="h-4 w-4 text-gray-500" />}
              <span className="text-sm text-gray-600">{metric.label}</span>
            </div>
            <span className={`font-mono font-semibold ${
              metric.status === 'warning' ? 'text-orange-600' : 
              metric.status === 'error' ? 'text-red-600' : 
              'text-gray-900'
            }`}>
              {metric.value}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

