'use client';
import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { MaximizeIcon, MinimizeIcon, MonitorIcon, RefreshCwIcon, XIcon, MousePointer2Icon } from 'lucide-react';
import type RFB from '@novnc/novnc';
import { openDesktop } from '@/app/chats/desktop-actions';
import { Button } from '@/components/ui/button';
const DesktopContext = createContext<{ open: boolean; toggle: () => void } | null>(null);
export function DesktopButton() {
  const desktop = useContext(DesktopContext);
  if (!desktop) return null;
  return <Button type="button" variant="ghost" size="icon-lg" onClick={desktop.toggle} aria-label="Open computer desktop" title="Computer desktop" aria-expanded={desktop.open}><MonitorIcon className="size-5" /></Button>;
}
export function DesktopWorkspace({ chatId, children, enabled }: { chatId: string; children: ReactNode; enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => { setOpen(false); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[aria-label="Open computer desktop"]')?.focus()); }, []);
  return <DesktopContext.Provider value={enabled ? { open, toggle: () => setOpen(v => !v) } : null}>
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      {enabled && open && <DesktopPanel chatId={chatId} onClose={close} />}
    </div>
  </DesktopContext.Provider>;
}
function DesktopPanel({ chatId, onClose }: { chatId: string; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const client = useRef<RFB | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState('Connecting to your computer…');
  const [connected, setConnected] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [control, setControl] = useState(false);
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let connection: RFB | undefined;
    void (async () => {
      try {
        const [access, module] = await Promise.all([openDesktop(chatId), import('@novnc/novnc')]);
        if (disposed || !screen.current) return;
        connection = new module.default(screen.current, access.url);
        client.current = connection;
        connection.viewOnly = true;
        connection.scaleViewport = true;
        connection.resizeSession = false;
        connection.addEventListener('connect', () => { if (!disposed) { setConnected(true); setStatus('Connected · View only'); } });
        connection.addEventListener('disconnect', () => { if (!disposed) { setConnected(false); setStatus('Disconnected. Reconnect to continue.'); } });
        connection.addEventListener('securityfailure', () => { if (!disposed) { setConnected(false); setStatus('Desktop access expired. Reconnect to renew it.'); } });
        timer = setTimeout(() => { if (!disposed) setStatus('Access expires soon. Reconnect if the connection drops.'); }, Math.max(0, access.expiresAt - Date.now() - 60000));
      } catch { if (!disposed) setStatus('Could not open the computer. Check Daytona configuration and retry.'); }
    })();
    return () => { disposed = true; clearTimeout(timer); connection?.disconnect(); client.current = null; };
  }, [chatId, attempt]);
  useEffect(() => { if (client.current) { client.current.viewOnly = !control; if (control) client.current.focus(); } }, [control]);
  useEffect(() => {
    const update = () => { if (!document.fullscreenElement) { setFullscreen(false); setControl(false); } };
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  useEffect(() => {
    closeButton.current?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape' && !document.fullscreenElement) {
        if (fullscreen) { setFullscreen(false); setControl(false); } else onClose();
      }
      if (event.key === 'Tab' && (fullscreen || window.innerWidth < 768)) {
        const items = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]');
        if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [fullscreen, onClose]);
  async function expand() {
    if (fullscreen) {
      if (document.fullscreenElement) await document.exitFullscreen();
      setFullscreen(false); setControl(false);
    } else {
      setFullscreen(true);
      try { await panel.current?.requestFullscreen(); } catch { /* CSS fullscreen remains available. */ }
    }
  }
  function reconnect() { setConnected(false); setControl(false); setStatus('Reconnecting…'); setAttempt(v => v + 1); }
  return <div ref={panel} role="region" aria-label="Computer desktop" className={fullscreen ? 'fixed inset-0 z-[100] flex flex-col bg-background' : 'fixed inset-0 z-40 flex flex-col bg-background md:relative md:z-auto md:w-[45%] md:min-w-80 md:border-l'}>
    <div className="flex flex-wrap items-center gap-1 border-b p-2">
      <span className="mr-auto px-2 text-sm font-medium">Computer</span>
      {fullscreen && <Button size="sm" variant={control ? 'secondary' : 'ghost'} disabled={!connected} onClick={() => setControl(v => !v)} aria-pressed={control}><MousePointer2Icon />{control ? 'Release control' : 'Take control'}</Button>}
      <Button size="icon" variant="ghost" onClick={reconnect} aria-label="Reconnect desktop"><RefreshCwIcon /></Button>
      <Button size="icon" variant="ghost" onClick={() => void expand()} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>{fullscreen ? <MinimizeIcon /> : <MaximizeIcon />}</Button>
      <Button ref={closeButton} size="icon" variant="ghost" onClick={onClose} aria-label="Close desktop"><XIcon /></Button>
    </div>
    <p role="status" className="px-4 py-2 text-xs text-muted-foreground">{connected && control ? 'You have control · Your changes affect the bot’s computer' : status}</p>
    <div ref={screen} className="min-h-0 flex-1 overflow-hidden bg-black" />
    {!fullscreen && <p className="p-3 text-xs text-muted-foreground">Watching your bot’s computer. Enter fullscreen to take control.</p>}
  </div>;
}
