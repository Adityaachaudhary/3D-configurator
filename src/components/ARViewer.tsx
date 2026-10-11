import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import X from "lucide-react/dist/esm/icons/x";
import ScanLine from "lucide-react/dist/esm/icons/scan-line";
import Smartphone from "lucide-react/dist/esm/icons/smartphone";
import { Button } from "@/components/ui/button";
import { ARCanvas, FABRICS, LEGS, type FabricId, type LegId } from "./SofaConfigurator";
import { arEligible, buildARUrl, readARConfiguration, type ARConfiguration } from "@/lib/ar-config";
import { BASE_SIZE } from "@/lib/sofa-spec";
import { formatINR, totalPrice } from "@/lib/pricing";
import { tileFor } from "@/lib/material-looks";

export const isARLaunch = () => new URLSearchParams(window.location.search).get("ar") === "1";
const fabricFor = (id: string) => FABRICS.find(f => f.id === id) ?? FABRICS[0];
const legFor = (id: string) => LEGS.find(l => l.id === id) ?? LEGS[0];

function QRModal({ config, onClose }: { config: ARConfiguration; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  const url = buildARUrl(window.location.href, config);
  useEffect(() => {
    if (canvas.current) void QRCode.toCanvas(canvas.current, url, { width: 220, margin: 2 }).catch(() => setError(true));
  }, [url]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="ar-qr-title" className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-panel" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between"><h2 id="ar-qr-title" className="font-display text-base font-semibold">Panache · in your room</h2><Button variant="ghost" size="icon-sm" aria-label="Close AR code" onClick={onClose}><X className="size-4" /></Button></div>
      <p className="mt-2 text-xs text-muted-foreground">Scan with an AR-compatible Android phone and open in Chrome.</p>
      <div className="my-5 flex justify-center"><canvas aria-label="Android AR QR code" ref={canvas} /></div>
      {error && <p className="text-xs text-destructive">The code could not load. Use the link below.</p>}
      <p className="text-xs text-muted-foreground">2 seater · {fabricFor(config.fabric)?.name} · {legFor(config.leg)?.name}</p>
      <Button asChild variant="outline" className="mt-4 w-full"><a href={url}>Open AR link</a></Button>
    </section>
  </div>, document.body);
}

function useARSession() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [session, setSession] = useState<XRSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  useEffect(() => {
    let active = true;
    if (!navigator.xr || !window.isSecureContext) { setSupported(false); return; }
    void navigator.xr.isSessionSupported("immersive-ar").then(ok => { if (active) setSupported(ok); }).catch(() => { if (active) setSupported(false); });
    return () => { active = false; };
  }, []);
  const start = useCallback(async () => {
    const xr = navigator.xr;
    if (!xr) { setError("Open this link in Chrome on an AR-compatible Android phone."); return; }
    setStarting(true); setError(null);
    try {
      const next = await xr.requestSession("immersive-ar", { requiredFeatures: ["hit-test", "local-floor", "dom-overlay"], domOverlay: { root: document.body } });
      next.addEventListener("end", () => setSession(null), { once: true });
      setSession(next);
    } catch { setError("AR could not start. Allow camera access and check Google Play Services for AR, then try again."); }
    finally { setStarting(false); }
  }, []);
  return { supported, session, error, starting, start, setError };
}

function AROverlay({ session, config, onError }: { session: XRSession; config: ARConfiguration; onError: (message: string) => void }) {
  const first = fabricFor(config.fabric), firstLeg = legFor(config.leg);
  const [fabric, setFabric] = useState<FabricId>(first?.id ?? "oat");
  const [leg, setLeg] = useState<LegId>(firstLeg?.id ?? "oak");
  const [tile, setTile] = useState(config.tile);
  const [placed, setPlaced] = useState(false);
  const [ready, setReady] = useState(false);
  const [scale, setScale] = useState(1);
  const [reset, setReset] = useState(0);
  const surface = useRef<HTMLDivElement>(null);
  const readyCallback = useCallback(() => setReady(true), []);
  const selected = fabricFor(fabric);
  const exit = () => { void session.end().catch(() => {}); };
  useEffect(() => {
    const previous = document.body.style.background;
    const previousTouch = document.body.style.touchAction;
    document.body.style.touchAction = "none";
    document.body.style.background = "transparent";
    return () => { document.body.style.background = previous; document.body.style.touchAction = previousTouch; };
  }, []);
  return createPortal(<div className="fixed inset-0 z-50 bg-transparent text-foreground" data-ar-overlay>
    <div className="absolute inset-0"><ARCanvas session={session} fabric={fabric} leg={leg} textureScale={tile} surface={surface} onPlaced={setPlaced} onScale={setScale} onReady={readyCallback} onError={onError} resetSignal={reset} /></div>
    <div ref={surface} className="absolute inset-0 touch-none" aria-label="AR placement surface" />
    <header className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-border bg-surface px-4 py-3">
      <div><p className="font-display text-sm font-semibold">Panache · 2 seater</p><p role="status" className="mt-1 text-xs text-muted-foreground">{placed ? "Placed on floor" : ready ? "Find the floor · tap the ring to place" : "Preparing your sofa…"}</p></div>
      <Button variant="outline" size="icon-sm" aria-label="Exit AR" onClick={exit}><X className="size-4" /></Button>
    </header>
    {placed && <section className="absolute inset-x-0 bottom-0 border-t border-border bg-surface px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Total · mock price</span><strong className="font-display text-lg">{formatINR(totalPrice(2, selected ?? { weave: "boucle" }, leg))}</strong></div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-[11px] text-muted-foreground">Upholstery<select aria-label="AR upholstery" value={fabric} onChange={e => { const next = fabricFor(e.target.value); if (next) { setFabric(next.id); setTile(tileFor(next.id, config.tile)); } }} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground">{FABRICS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <label className="text-[11px] text-muted-foreground">Leg finish<select aria-label="AR leg finish" value={leg} onChange={e => { const next = legFor(e.target.value); if (next) setLeg(next.id); }} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground">{LEGS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] text-muted-foreground">W {(BASE_SIZE.width*scale*100).toFixed(1)} × D {(BASE_SIZE.depth*scale*100).toFixed(1)} × H {(BASE_SIZE.height*scale*100).toFixed(1)} cm · {Math.round(scale*100)}%</span><Button variant="outline" size="sm" onClick={() => setReset(v => v+1)}>Real size</Button></div>
    </section>}
  </div>, document.body);
}

export function ARLaunchScreen() {
  const ar = useARSession();
  const config = readARConfiguration(window.location.search);
  if (ar.session) return <AROverlay session={ar.session} config={config} onError={ar.setError} />;
  return <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center text-foreground">
    <Smartphone className="mb-5 size-8 text-primary" /><h1 className="font-display text-2xl font-semibold">Panache · in your room</h1>
    <p className="mt-3 text-sm text-muted-foreground">2 seater · 147.3 × 83.8 × 81.3 cm</p>
    <p className="mt-1 text-xs text-muted-foreground">{fabricFor(config.fabric)?.name} · {legFor(config.leg)?.name}</p>
    {ar.supported === null && <p className="mt-6 text-sm text-muted-foreground">Checking AR availability…</p>}
    {ar.supported === false && <div className="mt-6 max-w-sm"><p className="text-sm font-semibold">AR is unavailable on this device</p><p className="mt-2 text-xs text-muted-foreground">{window.isSecureContext ? "Use Chrome on an AR-compatible Android phone with Google Play Services for AR installed." : "AR needs a secure HTTPS link. Open the hosted app on your Android phone."}</p></div>}
    {ar.error && <p role="alert" className="mt-5 max-w-sm text-sm text-destructive">{ar.error}</p>}
    {ar.supported && <Button className="mt-6" disabled={ar.starting} onClick={() => void ar.start()}><Smartphone className="size-4" />{ar.starting ? "Starting…" : "Start AR"}</Button>}
    <Button asChild variant="ghost" className="mt-4"><a href={window.location.pathname}>Back to configurator</a></Button>
  </main>;
}

export function ARButton({ seats, fabric, leg, tile }: ARConfiguration & { seats: number }) {
  const [qr, setQr] = useState(false);
  if (!arEligible(seats)) return null;
  const config = { fabric, leg, tile };
  return <>
    <Button variant="outline" size="sm" onClick={() => { if (/android/i.test(navigator.userAgent)) window.location.assign(buildARUrl(window.location.href, config)); else setQr(true); }}><ScanLine className="size-3.5" />View in AR</Button>
    {qr && <QRModal config={config} onClose={() => setQr(false)} />}
  </>;
}
