import React, { useEffect, useState } from 'react';

interface BrandPageProps {
  apiBase: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function BrandPage({ apiBase, showToast }: BrandPageProps) {
  const [appName, setAppName] = useState('Apex Arcade');
  const [shortName, setShortName] = useState('APEX');
  const [tagline, setTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${apiBase}/api/v1/admin/brand`).then(r => r.json()).then(json => {
      if (!json?.data) return;
      setAppName(json.data.appName || '');
      setShortName(json.data.shortName || '');
      setTagline(json.data.tagline || '');
      setLogoUrl(json.data.logoUrl || '');
    }).catch(() => showToast('Could not load the website settings.', 'error'));
  }, [apiBase, showToast]);

  const onLogo = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 256 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        setLogoUrl(canvas.toDataURL('image/jpeg', 0.8));
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/brand`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName, shortName, tagline, logoUrl })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      showToast('Website name and logo saved.', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h2 className="text-lg font-black">Website</h2>
        <p className="text-xs text-slate-400 mt-1">The name, short name, tagline, and logo shown on the landing page, the player app, this desk, and the payment desk.</p>
      </div>
      <label className="block text-xs text-slate-400">Website name
        <input value={appName} onChange={e => setAppName(e.target.value)} className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
      </label>
      <label className="block text-xs text-slate-400">Short name
        <input value={shortName} onChange={e => setShortName(e.target.value)} className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
      </label>
      <label className="block text-xs text-slate-400">Tagline
        <input value={tagline} onChange={e => setTagline(e.target.value)} className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
      </label>
      <label className="block text-xs text-slate-400">Logo
        <input type="file" accept="image/*" onChange={e => onLogo(e.target.files?.[0])} className="mt-1 block text-xs" />
      </label>
      {logoUrl && <img src={logoUrl} alt="" className="w-16 h-16 rounded-xl object-cover border border-white/10" />}
      <button type="button" disabled={saving} onClick={save} className="px-4 py-2 rounded-lg bg-[#00F59B] text-black text-sm font-black disabled:opacity-50">
        {saving ? 'Saving…' : 'Save website'}
      </button>
    </div>
  );
}
