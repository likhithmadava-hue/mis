import { useState } from 'react';
import { BookOpen, Check, PlusCircle, Trash2 } from 'lucide-react';
import type { TopicItem } from '../../core/db';
import Select from '../../core/ui/Select';
import { TOPIC_COLUMNS } from '../../core/ui/labels';

interface TopicsPanelProps {
  topics: TopicItem[];
  onAdd: (name: string, type: TopicItem['type']) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * The running backlog of what's been taught, what still needs revising, and
 * what still needs solving. Academic mode only — the Growth Tracker charts the
 * same three buckets as progress bars.
 */
export default function TopicsPanel({ topics, onAdd, onToggle, onDelete }: TopicsPanelProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<TopicItem['type']>('taught');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(name, type);
    setName('');
  };

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-6 space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-space flex items-center gap-2 border-b border-border pb-3">
        <BookOpen size={16} className="text-primary" /> Topics
      </h3>

      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="e.g. Physics — Work & Energy"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 h-9 px-3 bg-background border border-border rounded-xl text-xs"
        />
        <Select
          ariaLabel="Topic list"
          className="sm:w-44"
          value={type}
          onChange={setType}
          options={TOPIC_COLUMNS.map((c) => ({ value: c.type, label: c.title }))}
        />
        <button
          type="submit"
          className="h-9 px-4 bg-primary text-primary-foreground font-semibold rounded-xl text-xs flex items-center justify-center gap-1"
        >
          <PlusCircle size={14} /> Add
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {TOPIC_COLUMNS.map(({ type: colType, title }) => {
          const items = topics.filter((t) => t.type === colType);
          const remaining = items.filter((t) => !t.done).length;
          return (
            <div key={colType} className="p-3 bg-background border border-border rounded-xl space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  {title}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    colType === 'taught'
                      ? 'bg-primary/10 text-primary'
                      : remaining === 0 && items.length > 0
                      ? 'bg-success/15 text-success'
                      : 'bg-yellow-500/10 text-yellow-500'
                  }`}
                >
                  {colType === 'taught' ? items.length : `${remaining} left`}
                </span>
              </div>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-5">Nothing here yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                  {items.map((t) => (
                    <div
                      key={t.id}
                      className={`px-3 py-2 border rounded-lg flex items-center justify-between gap-2 group ${
                        t.done ? 'bg-success/5 border-success/30' : 'bg-card border-border'
                      }`}
                    >
                      <span
                        className={`text-xs flex-1 min-w-0 truncate ${t.done ? 'line-through text-success' : ''}`}
                        title={t.name}
                      >
                        {t.name}
                      </span>
                      <span className="flex items-center gap-1 flex-shrink-0">
                        {colType !== 'taught' && (
                          <button
                            onClick={() => onToggle(t.id)}
                            title={t.done ? 'Mark as not done' : 'Mark as done'}
                            aria-label={t.done ? `Mark "${t.name}" as incomplete` : `Mark "${t.name}" as complete`}
                            className={`w-5 h-5 rounded border flex items-center justify-center focus-visible:ring-2 focus-visible:ring-primary/50 outline-none ${
                              t.done
                                ? 'bg-success/20 border-success text-success'
                                : 'bg-muted border-border text-muted-foreground hover:border-success/60 hover:text-success'
                            }`}
                          >
                            {t.done && <Check size={11} strokeWidth={3} />}
                          </button>
                        )}
                        <button
                          onClick={() => onDelete(t.id)}
                          title="Delete topic"
                          aria-label={`Delete topic "${t.name}"`}
                          className="text-muted-foreground hover:text-destructive p-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:ring-2 focus-visible:ring-destructive/50 outline-none rounded"
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
