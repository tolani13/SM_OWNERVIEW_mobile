import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning';
}

export const StatCard = ({ title, value, subtitle, icon, variant = 'default' }: StatCardProps) => {
  return (
    <div className={cn(
      'rounded-xl p-5 transition-all duration-200 hover:shadow-card-lg',
      variant === 'primary' && 'bg-primary text-primary-foreground',
      variant === 'success' && 'bg-success text-success-foreground',
      variant === 'warning' && 'bg-warning text-warning-foreground',
      variant === 'default' && 'bg-card shadow-card'
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className={cn(
            'text-sm font-medium',
            variant === 'default' ? 'text-muted-foreground' : 'opacity-90'
          )}>
            {title}
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className={cn(
              'mt-1 text-sm',
              variant === 'default' ? 'text-muted-foreground' : 'opacity-80'
            )}>
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className={cn(
            'rounded-lg p-2',
            variant === 'default' ? 'bg-secondary' : 'bg-background/20'
          )}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};
