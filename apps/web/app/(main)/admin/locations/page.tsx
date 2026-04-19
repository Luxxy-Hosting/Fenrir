'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import AuthenticationContext from '@/app/_context/authentication';
import { api, type LocationConfig } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Button } from '@workspace/ui/components/button';
import { PlusIcon, TrashIcon, PencilIcon, XIcon, CheckIcon, ChevronDownIcon } from 'lucide-react';

const COUNTRIES: { code: string; name: string }[] = [
  { code: 'ad', name: 'Andorra' }, { code: 'ae', name: 'United Arab Emirates' }, { code: 'af', name: 'Afghanistan' },
  { code: 'ag', name: 'Antigua and Barbuda' }, { code: 'al', name: 'Albania' }, { code: 'am', name: 'Armenia' },
  { code: 'ao', name: 'Angola' }, { code: 'ar', name: 'Argentina' }, { code: 'at', name: 'Austria' },
  { code: 'au', name: 'Australia' }, { code: 'az', name: 'Azerbaijan' }, { code: 'ba', name: 'Bosnia and Herzegovina' },
  { code: 'bb', name: 'Barbados' }, { code: 'bd', name: 'Bangladesh' }, { code: 'be', name: 'Belgium' },
  { code: 'bf', name: 'Burkina Faso' }, { code: 'bg', name: 'Bulgaria' }, { code: 'bh', name: 'Bahrain' },
  { code: 'bi', name: 'Burundi' }, { code: 'bj', name: 'Benin' }, { code: 'bn', name: 'Brunei' },
  { code: 'bo', name: 'Bolivia' }, { code: 'br', name: 'Brazil' }, { code: 'bs', name: 'Bahamas' },
  { code: 'bt', name: 'Bhutan' }, { code: 'bw', name: 'Botswana' }, { code: 'by', name: 'Belarus' },
  { code: 'bz', name: 'Belize' }, { code: 'ca', name: 'Canada' }, { code: 'cd', name: 'DR Congo' },
  { code: 'cf', name: 'Central African Republic' }, { code: 'cg', name: 'Republic of the Congo' },
  { code: 'ch', name: 'Switzerland' }, { code: 'ci', name: 'Ivory Coast' }, { code: 'cl', name: 'Chile' },
  { code: 'cm', name: 'Cameroon' }, { code: 'cn', name: 'China' }, { code: 'co', name: 'Colombia' },
  { code: 'cr', name: 'Costa Rica' }, { code: 'cu', name: 'Cuba' }, { code: 'cv', name: 'Cape Verde' },
  { code: 'cy', name: 'Cyprus' }, { code: 'cz', name: 'Czech Republic' }, { code: 'de', name: 'Germany' },
  { code: 'dj', name: 'Djibouti' }, { code: 'dk', name: 'Denmark' }, { code: 'dm', name: 'Dominica' },
  { code: 'do', name: 'Dominican Republic' }, { code: 'dz', name: 'Algeria' }, { code: 'ec', name: 'Ecuador' },
  { code: 'ee', name: 'Estonia' }, { code: 'eg', name: 'Egypt' }, { code: 'er', name: 'Eritrea' },
  { code: 'es', name: 'Spain' }, { code: 'et', name: 'Ethiopia' }, { code: 'fi', name: 'Finland' },
  { code: 'fj', name: 'Fiji' }, { code: 'fm', name: 'Micronesia' }, { code: 'fr', name: 'France' },
  { code: 'ga', name: 'Gabon' }, { code: 'gb', name: 'United Kingdom' }, { code: 'gd', name: 'Grenada' },
  { code: 'ge', name: 'Georgia' }, { code: 'gh', name: 'Ghana' }, { code: 'gm', name: 'Gambia' },
  { code: 'gn', name: 'Guinea' }, { code: 'gq', name: 'Equatorial Guinea' }, { code: 'gr', name: 'Greece' },
  { code: 'gt', name: 'Guatemala' }, { code: 'gw', name: 'Guinea-Bissau' }, { code: 'gy', name: 'Guyana' },
  { code: 'hn', name: 'Honduras' }, { code: 'hr', name: 'Croatia' }, { code: 'ht', name: 'Haiti' },
  { code: 'hu', name: 'Hungary' }, { code: 'id', name: 'Indonesia' }, { code: 'ie', name: 'Ireland' },
  { code: 'il', name: 'Israel' }, { code: 'in', name: 'India' }, { code: 'iq', name: 'Iraq' },
  { code: 'ir', name: 'Iran' }, { code: 'is', name: 'Iceland' }, { code: 'it', name: 'Italy' },
  { code: 'jm', name: 'Jamaica' }, { code: 'jo', name: 'Jordan' }, { code: 'jp', name: 'Japan' },
  { code: 'ke', name: 'Kenya' }, { code: 'kg', name: 'Kyrgyzstan' }, { code: 'kh', name: 'Cambodia' },
  { code: 'ki', name: 'Kiribati' }, { code: 'km', name: 'Comoros' }, { code: 'kn', name: 'Saint Kitts and Nevis' },
  { code: 'kp', name: 'North Korea' }, { code: 'kr', name: 'South Korea' }, { code: 'kw', name: 'Kuwait' },
  { code: 'kz', name: 'Kazakhstan' }, { code: 'la', name: 'Laos' }, { code: 'lb', name: 'Lebanon' },
  { code: 'lc', name: 'Saint Lucia' }, { code: 'li', name: 'Liechtenstein' }, { code: 'lk', name: 'Sri Lanka' },
  { code: 'lr', name: 'Liberia' }, { code: 'ls', name: 'Lesotho' }, { code: 'lt', name: 'Lithuania' },
  { code: 'lu', name: 'Luxembourg' }, { code: 'lv', name: 'Latvia' }, { code: 'ly', name: 'Libya' },
  { code: 'ma', name: 'Morocco' }, { code: 'mc', name: 'Monaco' }, { code: 'md', name: 'Moldova' },
  { code: 'me', name: 'Montenegro' }, { code: 'mg', name: 'Madagascar' }, { code: 'mh', name: 'Marshall Islands' },
  { code: 'mk', name: 'North Macedonia' }, { code: 'ml', name: 'Mali' }, { code: 'mm', name: 'Myanmar' },
  { code: 'mn', name: 'Mongolia' }, { code: 'mr', name: 'Mauritania' }, { code: 'mt', name: 'Malta' },
  { code: 'mu', name: 'Mauritius' }, { code: 'mv', name: 'Maldives' }, { code: 'mw', name: 'Malawi' },
  { code: 'mx', name: 'Mexico' }, { code: 'my', name: 'Malaysia' }, { code: 'mz', name: 'Mozambique' },
  { code: 'na', name: 'Namibia' }, { code: 'ne', name: 'Niger' }, { code: 'ng', name: 'Nigeria' },
  { code: 'ni', name: 'Nicaragua' }, { code: 'nl', name: 'Netherlands' }, { code: 'no', name: 'Norway' },
  { code: 'np', name: 'Nepal' }, { code: 'nr', name: 'Nauru' }, { code: 'nz', name: 'New Zealand' },
  { code: 'om', name: 'Oman' }, { code: 'pa', name: 'Panama' }, { code: 'pe', name: 'Peru' },
  { code: 'pg', name: 'Papua New Guinea' }, { code: 'ph', name: 'Philippines' }, { code: 'pk', name: 'Pakistan' },
  { code: 'pl', name: 'Poland' }, { code: 'pt', name: 'Portugal' }, { code: 'pw', name: 'Palau' },
  { code: 'py', name: 'Paraguay' }, { code: 'qa', name: 'Qatar' }, { code: 'ro', name: 'Romania' },
  { code: 'rs', name: 'Serbia' }, { code: 'ru', name: 'Russia' }, { code: 'rw', name: 'Rwanda' },
  { code: 'sa', name: 'Saudi Arabia' }, { code: 'sb', name: 'Solomon Islands' }, { code: 'sc', name: 'Seychelles' },
  { code: 'sd', name: 'Sudan' }, { code: 'se', name: 'Sweden' }, { code: 'sg', name: 'Singapore' },
  { code: 'si', name: 'Slovenia' }, { code: 'sk', name: 'Slovakia' }, { code: 'sl', name: 'Sierra Leone' },
  { code: 'sm', name: 'San Marino' }, { code: 'sn', name: 'Senegal' }, { code: 'so', name: 'Somalia' },
  { code: 'sr', name: 'Suriname' }, { code: 'ss', name: 'South Sudan' }, { code: 'st', name: 'Sao Tome and Principe' },
  { code: 'sv', name: 'El Salvador' }, { code: 'sy', name: 'Syria' }, { code: 'sz', name: 'Eswatini' },
  { code: 'td', name: 'Chad' }, { code: 'tg', name: 'Togo' }, { code: 'th', name: 'Thailand' },
  { code: 'tj', name: 'Tajikistan' }, { code: 'tl', name: 'Timor-Leste' }, { code: 'tm', name: 'Turkmenistan' },
  { code: 'tn', name: 'Tunisia' }, { code: 'to', name: 'Tonga' }, { code: 'tr', name: 'Turkey' },
  { code: 'tt', name: 'Trinidad and Tobago' }, { code: 'tv', name: 'Tuvalu' }, { code: 'tz', name: 'Tanzania' },
  { code: 'ua', name: 'Ukraine' }, { code: 'ug', name: 'Uganda' }, { code: 'us', name: 'United States' },
  { code: 'uy', name: 'Uruguay' }, { code: 'uz', name: 'Uzbekistan' }, { code: 'va', name: 'Vatican City' },
  { code: 'vc', name: 'Saint Vincent and the Grenadines' }, { code: 've', name: 'Venezuela' },
  { code: 'vn', name: 'Vietnam' }, { code: 'vu', name: 'Vanuatu' }, { code: 'ws', name: 'Samoa' },
  { code: 'ye', name: 'Yemen' }, { code: 'za', name: 'South Africa' }, { code: 'zm', name: 'Zambia' },
  { code: 'zw', name: 'Zimbabwe' },
];

function flagUrl(code: string) {
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
}

const emptyLoc = { remoteUuid: '', name: '', short: '', country: '', flag: '' };

export default function AdminLocationsPage() {
  const { hasRole } = use(AuthenticationContext);
  const [locations, setLocations] = useState<LocationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<any>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      setLocations(await api.admin.listLocations(token));
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startNew = () => { setEditing('new'); setForm({ ...emptyLoc }); };
  const startEdit = (loc: LocationConfig) => { setEditing(loc.id); setForm({ ...loc }); };
  const cancel = () => { setEditing(null); setForm({}); };

  const save = async () => {
    const token = getAccessToken();
    if (!token) return;
    setMessage(null);
    try {
      if (editing === 'new') {
        await api.admin.createLocation(token, form);
      } else if (editing) {
        await api.admin.updateLocation(token, editing, form);
      }
      setEditing(null);
      load();
      setMessage({ type: 'success', text: 'Location saved' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this location?')) return;
    const token = getAccessToken();
    if (!token) return;
    try {
      await api.admin.deleteLocation(token, id);
      load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const updateForm = (key: string, value: any) => setForm((p: any) => ({ ...p, [key]: value }));

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Locations</h1>
          <p className="text-muted-foreground">Server deployment locations (must match Calagopus location UUIDs).</p>
        </div>
        <Button onClick={startNew} disabled={editing !== null}>
          <PlusIcon data-icon="inline-start" /> Add Location
        </Button>
      </div>

      {message && (
        <div className={`rounded-md p-3 text-sm ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
          {message.text}
        </div>
      )}

      {editing !== null && (
        <Card>
          <CardHeader><CardTitle>{editing === 'new' ? 'New Location' : 'Edit Location'}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Remote UUID (Calagopus)</Label>
              <Input value={form.remoteUuid ?? ''} onChange={(e) => updateForm('remoteUuid', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={form.name ?? ''} onChange={(e) => updateForm('name', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Short Code</Label>
              <Input placeholder="us-east" value={form.short ?? ''} onChange={(e) => updateForm('short', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Country</Label>
              <Input placeholder="United States" value={form.country ?? ''} onChange={(e) => updateForm('country', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Country Flag</Label>
              <FlagPicker value={form.flag ?? ''} onChange={(code) => updateForm('flag', code)} />
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={cancel}><XIcon data-icon="inline-start" /> Cancel</Button>
              <Button onClick={save}><CheckIcon data-icon="inline-start" /> Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {locations.length === 0 && editing === null && (
          <p className="text-muted-foreground text-center py-8">No locations configured yet.</p>
        )}
        {locations.map((loc) => (
          <Card key={loc.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                {loc.flag && (
                  <img src={flagUrl(loc.flag)} alt={loc.flag} className="h-5 w-8 object-cover rounded-sm shadow-sm" />
                )}
                <div>
                  <p className="font-medium">{loc.name}</p>
                  <p className="text-xs text-muted-foreground">{loc.remoteUuid.slice(0, 8)}... · {loc.short}{loc.country ? ` · ${loc.country}` : ''}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => startEdit(loc)} disabled={editing !== null}>
                  <PencilIcon className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(loc.id)}>
                  <TrashIcon className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function FlagPicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const selected = COUNTRIES.find((c) => c.code === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownH = 280;
      if (spaceBelow < dropdownH) {
        setDropdownStyle({ position: 'fixed', top: rect.top - dropdownH - 4, left: rect.left, width: rect.width, zIndex: 9999 });
      } else {
        setDropdownStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 });
      }
    }
    setSearch('');
    setOpen((o) => !o);
  };

  const filtered = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent transition-colors"
      >
        {selected ? (
          <>
            <img src={flagUrl(selected.code)} alt={selected.name} className="h-4 w-6 object-cover rounded-sm" />
            <span>{selected.name}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Select a flag…</span>
        )}
        <ChevronDownIcon className="ml-auto size-4 text-muted-foreground" />
      </button>

      {open && (
        <div ref={dropdownRef} style={dropdownStyle} className="rounded-md border bg-popover shadow-lg">
          <div className="p-2 border-b">
            <Input
              autoFocus
              placeholder="Search country…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">No results</p>
            )}
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => { onChange(c.code); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors ${
                  value === c.code ? 'bg-accent font-medium' : ''
                }`}
              >
                <img src={flagUrl(c.code)} alt={c.name} className="h-4 w-6 object-cover rounded-sm flex-shrink-0" />
                <span>{c.name}</span>
                <span className="ml-auto text-xs text-muted-foreground uppercase">{c.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
