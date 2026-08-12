import { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function WhatsAppFab() {
  const [link, setLink] = useState(null);
  useEffect(() => {
    api('/settings').then(s => {
      const n = String(s.whatsapp_number || '').replace(/\D/g, '');
      if (n) setLink('https://wa.me/' + ('212' + n.replace(/^0+/, '')));
    }).catch(() => {});
  }, []);
  if (!link) return null;
  return (
    <a href={link} target="_blank" rel="noreferrer" className="wa-fab" title="تواصل معنا واتساب">
      <svg viewBox="0 0 32 32" width="30" height="30"><path fill="white" d="M16 2C8.3 2 2 8.3 2 16c0 2.5.7 4.9 2 7L2 30l7.2-1.9c2 .9 4.5 1.4 6.8 1.4 7.7 0 14-6.3 14-14S23.7 2 16 2zm0 25.3c-2.1 0-4.2-.6-6-1.7l-.4-.2-4.3 1.1 1.1-4.2-.3-.4c-1.3-1.8-2-3.9-2-6.2 0-6.4 5.2-11.6 11.6-11.6S27.6 11.6 27.6 18s-5.2 11.3-11.6 11.3zm5.6-8.5c-.3-.2-1.8-.9-2-1s-.5-.2-.7.2-.8 1-.9 1.2-.3.2-.6.1-1.2-.4-2.2-1.3c-.8-.8-1.4-1.7-1.5-2s-.2-.3 0-.4c.1-.1.3-.4.4-.6.1-.2.2-.3.3-.5s0-.4 0-.5-.7-1.8-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4s-1 1-1 2.4 1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3 1.7.7 2.4.8 3.2.7.5 0 1.8-.7 2-1.4s.3-1.3.2-1.4c0-.2-.2-.2-.5-.4z"/></svg>
    </a>
  );
}
