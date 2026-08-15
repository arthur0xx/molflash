export default function Loading() {
  return <main className="route-loading" role="status" aria-live="polite">
    <span className="route-loading-mark" aria-hidden="true">CG</span>
    <div><b>جارٍ التحميل</b><p>لحظة واحدة، نجهّز الصفحة.</p></div>
  </main>;
}
