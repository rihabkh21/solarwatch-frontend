interface SensorStatusProps {
  name: string;
  value: string;
  isActive?: boolean;
}

export function SensorStatus({ name, value, isActive = true }: SensorStatusProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={`h-2 w-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}

