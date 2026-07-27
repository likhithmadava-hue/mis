import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface CardProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}

/**
 * The titled panel every chart on the Growth Tracker sits in. One shell means
 * the header spacing, rule and icon treatment can't drift between cards.
 */
export default function Card({ title, subtitle, icon: Icon, children, className = '' }: CardProps) {
  return (
    <div className={`bg-card rounded-2xl border border-border card-shadow p-6 space-y-4 ${className}`}>
      <div className="border-b border-border pb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-space flex items-center gap-2">
          <Icon size={16} className="text-primary" /> {title}
        </h3>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
