"use client";

import { usePathname } from "next/navigation";
import { Download, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

function isAppleMobile() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isSensitiveRoute(pathname: string) {
  return pathname === "/login"
    || pathname === "/admin"
    || pathname.startsWith("/service/")
    || pathname.startsWith("/verify-email")
    || pathname.startsWith("/phone-verification")
    || pathname.startsWith("/auth/");
}

export function PwaInstallPrompt() {
  const pathname = usePathname();
  const suppressPrompt = isSensitiveRoute(pathname);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [appleMobile, setAppleMobile] = useState(false);

  useEffect(() => {
    if (suppressPrompt || isStandalone()) return;

    const apple = isAppleMobile();
    const dismissed = window.sessionStorage.getItem("chrigsm-pwa-prompt-dismissed") === "1";
    const initialization = window.setTimeout(() => {
      setAppleMobile(apple);
      if (!dismissed && apple) setVisible(true);
    }, 0);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    void navigator.serviceWorker?.register("/sw.js").catch(() => undefined);
    return () => {
      window.clearTimeout(initialization);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [suppressPrompt]);

  function dismiss() {
    window.sessionStorage.setItem("chrigsm-pwa-prompt-dismissed", "1");
    setVisible(false);
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setVisible(false);
    setInstallEvent(null);
  }

  if (suppressPrompt || (!visible && !appleMobile)) return null;

  return <aside className="pwa-install-prompt" aria-label="تثبيت ChriGsm كتطبيق">
    <button className="pwa-dismiss" type="button" aria-label="إغلاق رسالة التثبيت" onClick={dismiss}><X size={16} /></button>
    <span className="pwa-install-icon" aria-hidden="true">{appleMobile ? <Share2 size={20} /> : <Download size={20} />}</span>
    <div><strong>ثبّت ChriGsm كتطبيق</strong>{appleMobile ? <p>من Safari اضغط مشاركة ثم «إضافة إلى الشاشة الرئيسية».</p> : <p>افتح المتجر بسرعة من شاشة هاتفك أو سطح المكتب.</p>}</div>
    {installEvent && <button className="primary-button pwa-install-action" type="button" onClick={() => { void install(); }}>تثبيت</button>}
  </aside>;
}
