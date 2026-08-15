"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function AppLoadingSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 820);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return <div className="app-splash" role="status" aria-live="polite" aria-label="جارٍ تحميل ChriGsm">
    <div className="app-splash-mark"><Image src="/brand/cg-logo.png" alt="" width={72} height={72} priority/></div>
    <div className="app-splash-copy"><b>ChriGsm</b><span>نجهّز خدماتك بأمان</span></div>
    <span className="app-splash-progress" aria-hidden="true"><i/></span>
  </div>;
}
