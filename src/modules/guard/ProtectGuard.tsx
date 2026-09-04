import { useState, useEffect } from 'react';
import { ArborDatabase, UserConfig } from '../../core/db';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Plus, 
  Trash2, 
  Smartphone, 
  EyeOff, 
  Activity, 
  AlertCircle 
} from 'lucide-react';

interface ProtectGuardProps {
  triggerUpdate: number;
  onBlocklistChange: () => void;
}

export default function ProtectGuard({ triggerUpdate, onBlocklistChange }: ProtectGuardProps) {
  const [user, setUser] = useState<UserConfig>(ArborDatabase.getUserConfig());
  const [newAppText, setNewAppText] = useState('');
  const [blockedTestDomain, setBlockedTestDomain] = useState('');
  const [testResult, setTestResult] = useState<{ status: 'blocked' | 'allowed' | null, message: string }>({ status: null, message: '' });

  useEffect(() => {
    setUser(ArborDatabase.getUserConfig());
  }, [triggerUpdate]);

  const handleAddApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppText.trim()) return;

    const trimmed = newAppText.trim();
    if (user.blocked_apps.includes(trimmed)) {
      setNewAppText('');
      return;
    }

    const updatedApps = [...user.blocked_apps, trimmed];
    const updatedConfig = { ...user, blocked_apps: updatedApps };
    ArborDatabase.saveUserConfig(updatedConfig);
    setUser(updatedConfig);
    setNewAppText('');
    onBlocklistChange();
  };

  const handleDeleteApp = (app: string) => {
    const updatedApps = user.blocked_apps.filter(a => a !== app);
    const updatedConfig = { ...user, blocked_apps: updatedApps };
    ArborDatabase.saveUserConfig(updatedConfig);
    setUser(updatedConfig);
    onBlocklistChange();
  };

  const handleTestBlocker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockedTestDomain.trim()) return;

    const testApp = blockedTestDomain.trim().toLowerCase();
    const match = user.blocked_apps.some(app => testApp.includes(app.toLowerCase()));

    if (match && user.is_focus_active) {
      setTestResult({
        status: 'blocked',
        message: `🚫 STRICT ACCESS DENIED: '${blockedTestDomain}' is locked under our Active Focus Perimeter Shield.`
      });
    } else if (match && !user.free_time_unlocked) {
      setTestResult({
        status: 'blocked',
        message: `🔒 LEISURE BLOCK ENGAGED: '${blockedTestDomain}' is locked until academic study & DPP milestones hit 100%.`
      });
    } else {
      setTestResult({
        status: 'allowed',
        message: `✅ ACCESS GRANTED: '${blockedTestDomain}' is open. Focus is inactive or goals are fully completed!`
      });
    }
    setBlockedTestDomain('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 bg-card rounded-2xl border border-border p-6 flex flex-col justify-between space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-space flex items-center gap-2"><Smartphone size={16} /> Perimeter Accessibility Controls</h3>
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${user.is_focus_active ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{user.is_focus_active ? 'Focus Locked' : 'Guard Active'}</span>
          </div>
          <form onSubmit={handleAddApp} className="flex gap-2">
            <input
              type="text"
              aria-label="New domain or app to block"
              placeholder="e.g. TikTok, Netflix"
              value={newAppText}
              onChange={(e) => setNewAppText(e.target.value)}
              className="flex-1 px-3 py-2 bg-background border border-border rounded-xl text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-xs flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary hover:opacity-90 transition-opacity"
            >
              <Plus size={14} /> Shield Domain
            </button>
          </form>
          <div className="grid grid-cols-2 gap-2">
            {user.blocked_apps.map(app => (
              <div key={app} className="p-3 bg-background border border-border rounded-xl flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-2"><EyeOff size={13} className="text-primary" /> {app}</span>
                <button
                  onClick={() => handleDeleteApp(app)}
                  title={`Remove ${app} from blocklist`}
                  aria-label={`Remove ${app} from blocklist`}
                  className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl">
          <div className="text-[11px] text-muted-foreground font-mono space-y-1">
            <p className="text-emerald-400">● [Accessibility Hook] Engaged successfully.</p>
            <p>● [Lockout Policy] {user.is_focus_active ? 'FORCE STRICTOR ENGAGED' : 'Awaiting focus sprint.'}</p>
          </div>
        </div>
      </div>

      <div className="lg:col-span-5 bg-card rounded-2xl border border-border p-6 flex flex-col justify-between">
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-space flex items-center gap-2"><ShieldAlert size={16} /> Perimeter Blocker Simulator</h3>
          <form onSubmit={handleTestBlocker} className="space-y-3">
            <input
              type="text"
              aria-label="Application or domain to test blocker"
              placeholder="Type application/domain..."
              required
              value={blockedTestDomain}
              onChange={(e) => setBlockedTestDomain(e.target.value)}
              className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <button
              type="submit"
              className="w-full py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
            >
              Inject Request
            </button>
          </form>
          {testResult.status && (
            <div className={`p-4 rounded-xl border ${testResult.status === 'blocked' ? 'bg-red-500/10 border-red-500/20 text-red-400 border-glow' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
              <p className="text-xs font-semibold">{testResult.message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
