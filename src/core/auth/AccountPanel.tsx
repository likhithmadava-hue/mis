import { useEffect, useRef, useState } from "preact/hooks";
import {
  AlertTriangle,
  Check,
  Cloud,
  CloudOff,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
} from "lucide-preact";
import { supabase } from "./client";
import { useAuth } from "./AuthProvider";
import {
  getSyncState,
  retrySync,
  subscribeSync,
  type SyncState,
} from "../db/sync";

/**
 * The signed-in footer of the sidebar: who you are, whether your work has made
 * it to the cloud, and the two things you might want to do about it.
 *
 * The sync dot matters more than it looks. MIS saves locally first and uploads
 * afterwards, which is what keeps it usable offline — but it also means "saved"
 * and "backed up" are two different states, and you should be able to see which
 * one you are in without having to trust that it worked.
 */

const STATUS: Record<
  SyncState["status"],
  { icon: typeof Cloud; text: string; className: string; spin?: boolean }
> = {
  off: {
    icon: CloudOff,
    text: "Local only",
    className: "text-muted-foreground",
  },
  pulling: {
    icon: Loader2,
    text: "Loading your data…",
    className: "text-muted-foreground",
    spin: true,
  },
  pushing: {
    icon: Loader2,
    text: "Saving to cloud…",
    className: "text-muted-foreground",
    spin: true,
  },
  synced: { icon: Cloud, text: "Backed up", className: "text-success" },
  error: {
    icon: AlertTriangle,
    text: "Not backed up",
    className: "text-warning",
  },
};

export default function AccountPanel({ collapsed }: { collapsed: boolean }) {
  const { label, signOut } = useAuth();
  const [sync, setSync] = useState<SyncState>(getSyncState);
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeSync(setSync), []);

  // close the popover on an outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) {
        setOpen(false);
        setChanging(false);
        setMessage("");
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const changePassword = async () => {
    if (!supabase) return;
    if (password.length < 6) {
      setMessage("Use at least 6 characters.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    setMessage(error ? error.message : "Password changed.");
    if (!error) setPassword("");
  };

  const status = STATUS[sync.status];
  const StatusIcon = status.icon;
  const initial = (label.trim()[0] ?? "?").toUpperCase();

  return (
    // relative + absolute, not fixed: body { zoom: 1.25 } throws off viewport
    // maths, so the popover is positioned against this box instead
    <div ref={wrapper} className="relative">
      {open && (
        // the sidebar is a top strip on mobile and a left column from sm up, so
        // the popover drops down there and rises here
        <div className="absolute top-full right-0 mt-2 sm:top-auto sm:bottom-full sm:left-0 sm:right-auto sm:mt-0 sm:mb-2 w-56 z-30 bg-card border border-border rounded-xl card-shadow p-1.5">
          <p className="px-2.5 py-2 text-[11px] text-muted-foreground break-all leading-snug">
            {label}
          </p>

          <div
            className={`px-2.5 py-1.5 text-[11px] flex items-start gap-2 ${status.className}`}
            title={sync.message}
          >
            <StatusIcon
              size={13}
              className={`flex-shrink-0 mt-px ${status.spin ? "animate-spin" : ""}`}
            />
            <span className="min-w-0">
              {status.text}
              {sync.status === "error" && sync.message && (
                <span className="block text-muted-foreground/80 break-words mt-0.5">
                  {sync.message}
                </span>
              )}
            </span>
          </div>

          {sync.status === "error" && (
            <button
              onClick={() => void retrySync()}
              className="w-full px-2.5 py-2 rounded-lg text-xs text-left flex items-center gap-2 text-foreground hover:bg-sidebar-accent transition-colors"
            >
              <RefreshCw size={13} />
              Try syncing again
            </button>
          )}

          <div className="h-px bg-border my-1" />

          {changing ? (
            <div className="p-1.5 space-y-2">
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                placeholder="New password"
                className="w-full h-9 px-2.5 rounded-lg bg-background border border-border text-xs"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => void changePassword()}
                  className="flex-1 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Check size={13} />
                  Save
                </button>
                <button
                  onClick={() => {
                    setChanging(false);
                    setPassword("");
                    setMessage("");
                  }}
                  className="h-8 px-3 rounded-lg bg-muted border border-border text-xs"
                >
                  Cancel
                </button>
              </div>
              {message && (
                <p className="text-[11px] text-muted-foreground">{message}</p>
              )}
            </div>
          ) : (
            <button
              onClick={() => {
                setChanging(true);
                setMessage("");
              }}
              className="w-full px-2.5 py-2 rounded-lg text-xs text-left flex items-center gap-2 text-foreground hover:bg-sidebar-accent transition-colors"
            >
              <KeyRound size={13} />
              Change password
            </button>
          )}

          <button
            onClick={() => void signOut()}
            className="w-full px-2.5 py-2 rounded-lg text-xs text-left flex items-center gap-2 text-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        title={`${label} — ${status.text}`}
        aria-label="Account"
        aria-expanded={open}
        className={`w-full py-2 rounded-xl flex items-center gap-2.5 transition-colors hover:bg-sidebar-accent ${
          collapsed ? "px-0 justify-center" : "px-2"
        }`}
      >
        <span className="relative flex-shrink-0">
          <span className="w-7 h-7 rounded-full bg-accent border border-primary/25 flex items-center justify-center text-[11px] font-bold font-space text-primary">
            {initial}
          </span>
          {/* the dot rides the avatar so the state is visible while collapsed */}
          <StatusIcon
            size={11}
            className={`absolute -bottom-0.5 -right-0.5 rounded-full bg-sidebar ${status.className} ${
              status.spin ? "animate-spin" : ""
            }`}
          />
        </span>
        {!collapsed && (
          <span className="min-w-0 text-left">
            <span className="block text-xs font-medium truncate">{label}</span>
            <span className={`block text-[10px] ${status.className}`}>
              {status.text}
            </span>
          </span>
        )}
      </button>
    </div>
  );
}
