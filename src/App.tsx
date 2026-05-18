import { useState, useEffect, useRef } from 'react'

declare global { interface Window { google: any } }

// ===== TYPES =====
interface Company {
  name: string; taxId: string; email: string; pass: string; admin: string; tel: string
  country: string
  address: { street: string; number: string; complement: string; postalCode: string; city: string; region: string; state: string }
  dataConsent: boolean; consentDate: string
}
interface CountryItem {
  code: string; name: string; flag: string; phone: string
}
interface CulturalConfig {
  taxLabel: string
  postalLabel: string; postalPlaceholder: string
  postalMask: ((v: string) => string) | null; postalLookup: boolean
  streetLabel: string; cityLabel: string; regionLabel: string; stateLabel: string
  hasComplement: boolean; complementLabel: string
}
interface Documento {
  id: string; nome: string
  tipo: 'pessoal' | 'contrato' | 'recibo' | 'outro'
  fileName: string; dataUpload: string; fileObj?: File
}
interface Colaborador {
  id: string; nome: string; nif: string; cargo: string; departamento: string
  email: string; telefone: string; dataAdmissao: string
  tipoContrato: 'sem-termo' | 'termo-certo' | 'termo-incerto' | 'prestacao-servicos' | 'estagio'
  morada: { rua: string; numero: string; andar: string; codigoPostal: string; localidade: string; distrito: string }
  documentos: Documento[]
}

// ===== CULTURAL CONFIG =====
const EU_COUNTRIES = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'])

const DEFAULT_CULTURAL: CulturalConfig = {
  taxLabel: 'Tax ID', postalLabel: 'Postal Code', postalPlaceholder: '',
  postalMask: null, postalLookup: true,
  streetLabel: 'Street', cityLabel: 'City',
  stateLabel: 'State / Province', regionLabel: '',
  hasComplement: true, complementLabel: 'Address Line 2',
}

const CULTURAL_MAP: Record<string, Partial<CulturalConfig>> = {
  PT: { taxLabel: 'NIF', postalLabel: 'Código Postal', postalPlaceholder: '1100-150', postalMask: v => { const n = v.replace(/\D/g,''); return n.length > 4 ? n.slice(0,4)+'-'+n.slice(4,7) : n }, streetLabel: 'Rua / Avenida', cityLabel: 'Localidade', regionLabel: 'Freguesia', stateLabel: 'Distrito', complementLabel: 'Andar / Fração' },
  BR: { taxLabel: 'CNPJ', postalLabel: 'CEP', postalPlaceholder: '01310-100', postalMask: v => { const n = v.replace(/\D/g,''); return n.length > 5 ? n.slice(0,5)+'-'+n.slice(5,8) : n }, streetLabel: 'Logradouro', cityLabel: 'Cidade', regionLabel: 'Bairro', stateLabel: 'Estado', complementLabel: 'Complemento' },
  AO: { taxLabel: 'NIF', postalPlaceholder: '1234', postalLookup: false, cityLabel: 'Cidade', regionLabel: 'Município', stateLabel: 'Província', hasComplement: false, complementLabel: '' },
  MZ: { taxLabel: 'NUIT', postalPlaceholder: '1100', postalLookup: false, cityLabel: 'Cidade', stateLabel: 'Província', hasComplement: false, complementLabel: '' },
  CV: { taxLabel: 'NIF', postalPlaceholder: '7600', postalLookup: false, cityLabel: 'Cidade', stateLabel: 'Ilha', hasComplement: false, complementLabel: '' },
  ES: { taxLabel: 'CIF/NIF', postalPlaceholder: '28001', streetLabel: 'Calle / Avenida', cityLabel: 'Ciudad', regionLabel: 'Barrio', stateLabel: 'Comunidad Autónoma', complementLabel: 'Piso / Puerta' },
  FR: { taxLabel: 'SIRET', postalLabel: 'Code Postal', postalPlaceholder: '75001', streetLabel: 'Rue / Avenue', cityLabel: 'Ville', regionLabel: '', stateLabel: 'Département', complementLabel: "Complément d'adresse" },
  DE: { taxLabel: 'Steuernummer', postalLabel: 'PLZ', postalPlaceholder: '10115', streetLabel: 'Straße', cityLabel: 'Stadt', regionLabel: '', stateLabel: 'Bundesland', hasComplement: false, complementLabel: '' },
  GB: { taxLabel: 'Company No.', postalLabel: 'Postcode', postalPlaceholder: 'SW1A 1AA', streetLabel: 'Street Address', cityLabel: 'City', regionLabel: '', stateLabel: 'County', complementLabel: 'Address Line 2' },
  US: { taxLabel: 'EIN', postalLabel: 'ZIP Code', postalPlaceholder: '10001', streetLabel: 'Street Address', cityLabel: 'City', regionLabel: '', stateLabel: 'State', complementLabel: 'Apt / Suite' },
  CA: { taxLabel: 'Business No.', postalLabel: 'Postal Code', postalPlaceholder: 'M5V 3L9', streetLabel: 'Street Address', cityLabel: 'City', regionLabel: '', stateLabel: 'Province', complementLabel: 'Unit / Suite' },
}

function getConfig(code: string): CulturalConfig & { isEU: boolean } {
  return { ...DEFAULT_CULTURAL, ...CULTURAL_MAP[code], isEU: EU_COUNTRIES.has(code) }
}

// ===== COLABORADORES — constantes =====
const CONTRATO_LABELS: Record<string, string> = {
  'sem-termo': 'Sem Termo', 'termo-certo': 'Termo Certo', 'termo-incerto': 'Termo Incerto',
  'prestacao-servicos': 'Prestação de Serviços', 'estagio': 'Estágio',
}
const DOC_TIPO_ICONS: Record<string, string> = {
  pessoal: '🪪', contrato: '📄', recibo: '💰', outro: '📎',
}
const DOC_TIPO_LABELS: Record<string, string> = {
  pessoal: 'Pessoal', contrato: 'Contrato', recibo: 'Recibo', outro: 'Outro',
}

// ===== FALLBACK =====
const FALLBACK_COUNTRIES: CountryItem[] = [
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', phone: '+351' },
  { code: 'BR', name: 'Brasil', flag: '🇧🇷', phone: '+55' },
  { code: 'AO', name: 'Angola', flag: '🇦🇴', phone: '+244' },
  { code: 'MZ', name: 'Moçambique', flag: '🇲🇿', phone: '+258' },
  { code: 'CV', name: 'Cabo Verde', flag: '🇨🇻', phone: '+238' },
  { code: 'ES', name: 'Espanha', flag: '🇪🇸', phone: '+34' },
  { code: 'FR', name: 'França', flag: '🇫🇷', phone: '+33' },
  { code: 'DE', name: 'Alemanha', flag: '🇩🇪', phone: '+49' },
  { code: 'GB', name: 'Reino Unido', flag: '🇬🇧', phone: '+44' },
  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', phone: '+1' },
  { code: 'CA', name: 'Canadá', flag: '🇨🇦', phone: '+1' },
]

// ===== HELPERS =====
function validarEmail(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) }
function forcaSenha(p: string) {
  let s = 0
  if (p.length >= 8) s++; if (/[A-Z]/.test(p)) s++; if (/[a-z]/.test(p)) s++
  if (/[0-9]/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++
  return s
}
async function lookupPostal(cp: string, country: string) {
  try {
    if (country === 'PT') {
      const r = await fetch(`https://json.geoapi.pt/cp/${encodeURIComponent(cp)}`)
      if (!r.ok) return null
      const d = await r.json()
      return { city: d.localidade || d.Localidade || '', state: d.distrito || d.Distrito || '', region: '', street: '' }
    }
    if (country === 'BR') {
      const cep = cp.replace(/\D/g, '')
      if (cep.length !== 8) return null
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      if (!r.ok) return null
      const d = await r.json()
      if (d.erro) return null
      return { city: d.localidade || '', state: d.uf || '', region: d.bairro || '', street: d.logradouro || '' }
    }
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(cp)}&countrycodes=${country.toLowerCase()}&format=json&limit=1&addressdetails=1`,
      { headers: { 'Accept-Language': 'pt' } }
    )
    if (!r.ok) return null
    const d = await r.json()
    if (!Array.isArray(d) || d.length === 0) return null
    const a = d[0].address ?? {}
    return {
      city: a.city || a.town || a.village || a.municipality || a.county || '',
      state: a.state || a.county || '',
      region: a.suburb || a.neighbourhood || a.district || '',
      street: a.road || '',
    }
  } catch { /**/ }
  return null
}

// ===== INITIAL DATA =====
const initialCompanies: Company[] = [{
  name: 'Clínica Saúde Lisboa, Lda.', taxId: '500123456', email: 'admin@clinica.pt', pass: 'Admin@2024',
  admin: 'Maria Silva', tel: '+351 21 000 0000', country: 'PT',
  address: { street: 'Rua Augusta', number: '42', complement: '2º Dto', postalCode: '1100-150', city: 'Lisboa', region: '', state: 'Lisboa' },
  dataConsent: true, consentDate: '2024-01-10',
}]

const initialAllColaboradores: Record<string, Colaborador[]> = {
  'admin@clinica.pt': [
    {
      id: 'c1', nome: 'Ana Costa', nif: '123456789', cargo: 'Enfermeira', departamento: 'Clínica',
      email: 'ana.costa@clinica.pt', telefone: '+351 912 000 001', dataAdmissao: '2022-03-01',
      tipoContrato: 'sem-termo',
      morada: { rua: 'Rua das Flores', numero: '10', andar: '1º Esq', codigoPostal: '1200-192', localidade: 'Lisboa', distrito: 'Lisboa' },
      documentos: [],
    },
    {
      id: 'c2', nome: 'Bruno Ferreira', nif: '987654321', cargo: 'Rececionista', departamento: 'Administrativo',
      email: 'bruno.ferreira@clinica.pt', telefone: '+351 912 000 002', dataAdmissao: '2023-06-15',
      tipoContrato: 'termo-certo',
      morada: { rua: 'Av. da Liberdade', numero: '200', andar: '3º Dto', codigoPostal: '1250-147', localidade: 'Lisboa', distrito: 'Lisboa' },
      documentos: [],
    },
  ],
}

// ===== STYLES =====
const s = {
  wrap: { background: '#f1f5f9', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', fontFamily: 'system-ui, sans-serif' } as React.CSSProperties,
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '440px' } as React.CSSProperties,
  logoArea: { textAlign: 'center' as const, marginBottom: '1.75rem' },
  logoIcon: { width: '48px', height: '48px', borderRadius: '12px', background: '#eff6ff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px', fontSize: '24px' },
  title: { fontSize: '20px', fontWeight: 500, color: '#0f172a', margin: 0 },
  sub: { fontSize: '13px', color: '#64748b', marginTop: '4px' },
  label: { display: 'block', fontSize: '12px', fontWeight: 500, color: '#475569', marginBottom: '5px' },
  input: { width: '100%', padding: '0 10px', height: '38px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#fff', color: '#0f172a', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const },
  inputErr: { width: '100%', padding: '0 10px', height: '38px', border: '1px solid #ef4444', borderRadius: '8px', background: '#fff', color: '#0f172a', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const },
  inputOk: { width: '100%', padding: '0 10px', height: '38px', border: '1px solid #22c55e', borderRadius: '8px', background: '#f0fdf4', color: '#0f172a', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const },
  inputFilled: { width: '100%', padding: '0 10px', height: '38px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc', color: '#475569', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const },
  hint: { fontSize: '11px', color: '#94a3b8', marginTop: '3px' },
  hintErr: { fontSize: '11px', color: '#ef4444', marginTop: '3px' },
  hintOk: { fontSize: '11px', color: '#16a34a', marginTop: '3px' },
  btnMain: { width: '100%', height: '40px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', marginTop: '4px' },
  btnGoogle: { width: '100%', height: '40px', background: '#fff', color: '#1a1a1a', border: '1px solid #dadce0', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '6px' } as React.CSSProperties,
  btnRegister: { width: '100%', height: '40px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '6px' } as React.CSSProperties,
  btnOutline: { width: '100%', height: '40px', background: 'transparent', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '6px' } as React.CSSProperties,
  link: { fontSize: '13px', color: '#2563eb', cursor: 'pointer', background: 'none', border: 'none', padding: 0, textDecoration: 'underline' } as React.CSSProperties,
  divider: { display: 'flex', alignItems: 'center', gap: '8px', margin: '1rem 0' },
  dividerLine: { flex: 1, height: '1px', background: '#e2e8f0' },
  dividerTxt: { fontSize: '12px', color: '#94a3b8' },
  alertErr: { padding: '10px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '1rem', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' },
  alertOk: { padding: '10px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '1rem', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' },
  alertInfo: { padding: '10px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '1rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', display: 'flex', gap: '8px', lineHeight: '1.5' },
  backBtn: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#64748b', cursor: 'pointer', background: 'none', border: 'none', marginBottom: '1.25rem', padding: 0 } as React.CSSProperties,
  field: { marginBottom: '0.875rem' },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '0.875rem' },
  row3: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '0.875rem' },
  select: { width: '100%', padding: '0 8px', height: '38px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#fff', color: '#0f172a', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const },
  sectionLabel: { fontSize: '11px', fontWeight: 500, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '.05em', marginBottom: '8px', marginTop: '4px' },
  passWrap: { position: 'relative' as const },
  eyeBtn: { position: 'absolute' as const, right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 0 },
  companyItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer' },
  companyAvatar: { width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 500, color: '#2563eb', flexShrink: 0 },
  rgpdBox: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '0.875rem' },
  checkRow: { display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' },
  steps: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '1.5rem' },
  msgCenter: { fontSize: '13px', textAlign: 'center' as const, marginTop: '0.875rem', color: '#64748b' },
}

type Screen = 'login' | 'forgot' | 'register' | 'companies' | 'success' | 'dashboard'
type RegStep = 1 | 2 | 3
type LookupState = 'idle' | 'loading' | 'ok' | 'err'

function CountryPicker({ value, onChange, list }: { value: string; onChange: (code: string) => void; list: CountryItem[] }) {
  const [search, setSearch] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selected = list.find(c => c.code === value)
  const filtered = search
    ? list.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().startsWith(search.toLowerCase())
      )
    : list

  useEffect(() => { setHi(0) }, [search])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false); setSearch(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.children[hi] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [hi])

  function select(code: string) { onChange(code); setOpen(false); setSearch(null) }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) { if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); setSearch('') }; return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(i => Math.min(i + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[hi]) select(filtered[hi].code) }
    else if (e.key === 'Escape') { setOpen(false); setSearch(null) }
  }

  const displayVal = search !== null ? search : (selected ? `${selected.flag} ${selected.name}` : '')

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          style={{ ...s.select, cursor: search === null ? 'pointer' : 'text', paddingRight: '28px' }}
          value={displayVal}
          placeholder="Selecione um país..."
          onChange={e => { setSearch(e.target.value); setOpen(true); setHi(0) }}
          onFocus={() => { setSearch(''); setOpen(true) }}
          onKeyDown={onKeyDown}
        />
        <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '10px', pointerEvents: 'none' as const }}>▼</span>
      </div>
      {open && (
        <div ref={listRef} style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200, background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,.12)', maxHeight: '220px', overflowY: 'auto' }}>
          {filtered.length === 0
            ? <div style={{ padding: '10px 12px', fontSize: '13px', color: '#94a3b8' }}>Nenhum país encontrado</div>
            : filtered.map((c, i) => (
              <div
                key={c.code}
                onMouseDown={e => { e.preventDefault(); select(c.code) }}
                onMouseEnter={() => setHi(i)}
                style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', background: i === hi ? '#eff6ff' : c.code === value ? '#f0fdf4' : 'transparent', color: i === hi ? '#2563eb' : '#0f172a' }}
              >
                <span>{c.flag}</span>
                <span style={{ flex: 1 }}>{c.name}</span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>{c.phone}</span>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: '11px', fontWeight: 500, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 3px 0' }}>{label}</p>
      <p style={{ fontSize: '14px', color: '#0f172a', margin: 0 }}>{value || '—'}</p>
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('login')
  const [companies, setCompanies] = useState<Company[]>(initialCompanies)
  const [selectedCompany, setSelectedCompany] = useState<Company>(initialCompanies[0])
  const [alertState, setAlertState] = useState<{ type: 'err' | 'ok' | 'info'; msg: string } | null>(null)
  const [regStep, setRegStep] = useState<RegStep>(1)
  const [showPass, setShowPass] = useState(false)
  const [showRegPass, setShowRegPass] = useState(false)
  const [showRegPass2, setShowRegPass2] = useState(false)

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [forgotEmail, setForgotEmail] = useState('')

  // Step 1 — address
  const [regCountry, setRegCountry] = useState('PT')
  const [regPostal, setRegPostal] = useState('')
  const [regStreet, setRegStreet] = useState('')
  const [regNumber, setRegNumber] = useState('')
  const [regComplement, setRegComplement] = useState('')
  const [regCity, setRegCity] = useState('')
  const [regRegion, setRegRegion] = useState('')
  const [regStateAddr, setRegStateAddr] = useState('')
  const [lookupState, setLookupState] = useState<LookupState>('idle')
  // Step 1 — company
  const [regCompany, setRegCompany] = useState('')
  const [regTaxId, setRegTaxId] = useState('')
  const [regTelNum, setRegTelNum] = useState('')
  // Step 2 — admin
  const [regNome, setRegNome] = useState('')
  const [regEmail, setRegEmail] = useState('')
  // Step 3 — password + consent
  const [regPass, setRegPass] = useState('')
  const [regPass2, setRegPass2] = useState('')
  const [chkTerms, setChkTerms] = useState(false)
  const [chkData, setChkData] = useState(false)
  const [chkComm, setChkComm] = useState(false)
  // Success
  const [successTitle, setSuccessTitle] = useState('')
  const [successSub, setSuccessSub] = useState('')

  // Modal termos/privacidade
  const [modal, setModal] = useState<'terms' | 'privacy' | null>(null)

  // Lista de países
  const [countryList, setCountryList] = useState<CountryItem[]>(FALLBACK_COUNTRIES)

  // ===== DASHBOARD STATE =====
  const [colabView, setColabView] = useState<'list' | 'form' | 'detail'>('list')
  const [selectedColab, setSelectedColab] = useState<Colaborador | null>(null)
  const [colabDetailTab, setColabDetailTab] = useState<'dados' | 'documentos'>('dados')
  const [confirmDeleteColab, setConfirmDeleteColab] = useState<string | null>(null)
  const [allColaboradores, setAllColaboradores] = useState<Record<string, Colaborador[]>>(initialAllColaboradores)
  // Form — novo colaborador
  const [fNome, setFNome] = useState('')
  const [fNif, setFNif] = useState('')
  const [fCargo, setFCargo] = useState('')
  const [fDept, setFDept] = useState('')
  const [fEmail, setFEmail] = useState('')
  const [fTel, setFTel] = useState('')
  const [fDataAdm, setFDataAdm] = useState('')
  const [fContrato, setFContrato] = useState<Colaborador['tipoContrato']>('sem-termo')
  const [fRua, setFRua] = useState('')
  const [fNumero, setFNumero] = useState('')
  const [fAndar, setFAndar] = useState('')
  const [fCP, setFCP] = useState('')
  const [fLocalidade, setFLocalidade] = useState('')
  const [fDistrito, setFDistrito] = useState('')
  const [formColabErr, setFormColabErr] = useState('')
  // Upload
  const [uploadNome, setUploadNome] = useState('')
  const [uploadTipo, setUploadTipo] = useState<Documento['tipo']>('pessoal')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadErr, setUploadErr] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const cfg = getConfig(regCountry)
  const cfgPhone = countryList.find(c => c.code === regCountry)?.phone ?? ''

  const companiesRef = useRef(companies)
  companiesRef.current = companies

  useEffect(() => {
    fetch('https://restcountries.com/v3.1/all?fields=name,cca2,flag,idd,translations')
      .then(r => r.json())
      .then((data: any[]) => {
        const list: CountryItem[] = data
          .filter((c: any) => c.idd?.root && c.idd?.suffixes?.length > 0)
          .map((c: any) => ({
            code: c.cca2 as string,
            name: (c.translations?.por?.common || c.name.common) as string,
            flag: c.flag as string,
            phone: (c.idd.suffixes.length === 1 ? c.idd.root + c.idd.suffixes[0] : c.idd.root) as string,
          }))
          .sort((a: CountryItem, b: CountryItem) => a.name.localeCompare(b.name, 'pt'))
        setCountryList(list)
      })
      .catch(() => { /* mantém FALLBACK_COUNTRIES */ })
  }, [])

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    document.head.appendChild(script)
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
        callback: (response: any) => handleGoogleCredentialRef.current(response),
      })
    }
    return () => { if (document.head.contains(script)) document.head.removeChild(script) }
  }, [])

  const handleGoogleCredentialRef = useRef((response: any) => {
    try {
      const payload = JSON.parse(atob(response.credential.split('.')[1]))
      const email: string = payload.email
      const name: string = payload.name ?? ''
      const found = companiesRef.current.find(c => c.email === email)
      if (found) {
        setSelectedCompany(found)
        setSuccessTitle('Bem-vindo, ' + name.split(' ')[0] + '!')
        setSuccessSub('Acesso via Google efetuado')
        setScreen('success'); setAlertState(null)
      } else {
        setRegEmail(email)
        setRegNome(name)
        setAlertState({ type: 'info', msg: 'E-mail Google não registado. Complete o cadastro da sua empresa.' })
        setScreen('register'); setAlertState(prev => prev)
      }
    } catch { /**/ }
  })

  function triggerGoogle() { window.google?.accounts.id.prompt() }
  function goTo(sc: Screen) { setScreen(sc); setAlertState(null) }

  function resetAddressFields() {
    setRegPostal(''); setRegStreet(''); setRegNumber(''); setRegComplement('')
    setRegCity(''); setRegRegion(''); setRegStateAddr(''); setLookupState('idle')
  }

  function handlePostalChange(val: string) {
    const masked = cfg.postalMask ? cfg.postalMask(val) : val
    setRegPostal(masked)
    setLookupState('idle')
    setRegCity(''); setRegRegion(''); setRegStateAddr('')
  }

  async function doPostalLookup() {
    if (!regPostal || !cfg.postalLookup) return
    setLookupState('loading')
    const result = await lookupPostal(regPostal, regCountry)
    if (result) {
      if (result.city) setRegCity(result.city)
      if (result.region) setRegRegion(result.region)
      if (result.state) setRegStateAddr(result.state)
      if (result.street) setRegStreet(result.street)
      setLookupState('ok')
    } else {
      setLookupState('err')
    }
  }

  function doLogin() {
    if (!loginEmail || !loginPass) { setAlertState({ type: 'err', msg: 'Preencha o e-mail e a senha.' }); return }
    const found = companies.find(c => c.email === loginEmail && c.pass === loginPass)
    if (found) {
      setSelectedCompany(found)
      setSuccessTitle('Bem-vindo, ' + found.admin.split(' ')[0] + '!')
      setSuccessSub('Acesso efetuado com sucesso')
      goTo('success')
    } else {
      setAlertState({ type: 'err', msg: 'E-mail ou senha incorretos. Tente novamente.' })
    }
  }

  function doForgot() {
    if (!forgotEmail) { setAlertState({ type: 'err', msg: 'Introduza o seu e-mail.' }); return }
    const found = companies.find(c => c.email === forgotEmail)
    if (found) setAlertState({ type: 'ok', msg: 'Link enviado! Verifique a sua caixa de entrada.' })
    else setAlertState({ type: 'err', msg: 'E-mail não encontrado. Verifique ou cadastre uma nova empresa.' })
  }

  function regNext1() {
    setAlertState(null)
    if (!regCompany || !regTaxId || !regTelNum || !regPostal || !regStreet || !regCity || !regStateAddr) {
      setAlertState({ type: 'err', msg: 'Preencha todos os campos obrigatórios (*).' }); return
    }
    setRegStep(2)
  }

  function regNext2() {
    setAlertState(null)
    if (!regNome || !regEmail) { setAlertState({ type: 'err', msg: 'Preencha todos os campos obrigatórios (*).' }); return }
    if (!validarEmail(regEmail)) { setAlertState({ type: 'err', msg: 'Introduza um e-mail válido.' }); return }
    if (companies.find(c => c.email === regEmail)) { setAlertState({ type: 'err', msg: 'Este e-mail já está registado no sistema.' }); return }
    setRegStep(3)
  }

  function doRegister() {
    setAlertState(null)
    if (regPass.length < 8) { setAlertState({ type: 'err', msg: 'A senha deve ter pelo menos 8 caracteres.' }); return }
    if (!/[A-Z]/.test(regPass) || !/[0-9]/.test(regPass)) { setAlertState({ type: 'err', msg: 'A senha deve ter maiúsculas e pelo menos um número.' }); return }
    if (regPass !== regPass2) { setAlertState({ type: 'err', msg: 'As senhas não coincidem.' }); return }
    if (!chkTerms || !chkData) { setAlertState({ type: 'err', msg: 'Aceite os Termos de Uso e o consentimento de dados para continuar.' }); return }
    const nova: Company = {
      name: regCompany, taxId: regTaxId, email: regEmail, pass: regPass, admin: regNome,
      tel: cfgPhone + ' ' + regTelNum, country: regCountry,
      address: { street: regStreet, number: regNumber, complement: regComplement, postalCode: regPostal, city: regCity, region: regRegion, state: regStateAddr },
      dataConsent: true, consentDate: new Date().toISOString().split('T')[0],
    }
    setCompanies(prev => [...prev, nova])
    setSelectedCompany(nova)
    setSuccessTitle('Bem-vindo, ' + regNome.split(' ')[0] + '!')
    setSuccessSub('Empresa registada com sucesso')
    goTo('success')
  }

  // ===== COLABORADORES — funções =====
  const colaboradores = allColaboradores[selectedCompany.email] ?? []

  function updateColaboradores(fn: (prev: Colaborador[]) => Colaborador[]) {
    setAllColaboradores(prev => ({ ...prev, [selectedCompany.email]: fn(prev[selectedCompany.email] ?? []) }))
  }

  function resetFormColab() {
    setFNome(''); setFNif(''); setFCargo(''); setFDept(''); setFEmail(''); setFTel('')
    setFDataAdm(''); setFContrato('sem-termo'); setFRua(''); setFNumero(''); setFAndar('')
    setFCP(''); setFLocalidade(''); setFDistrito(''); setFormColabErr('')
  }

  function adicionarColaborador() {
    setFormColabErr('')
    if (!fNome || !fNif || !fCargo || !fDept || !fEmail || !fTel || !fDataAdm) {
      setFormColabErr('Preencha todos os campos obrigatórios (*).'); return
    }
    if (!validarEmail(fEmail)) { setFormColabErr('Introduza um e-mail válido.'); return }
    const novo: Colaborador = {
      id: Date.now().toString(),
      nome: fNome, nif: fNif, cargo: fCargo, departamento: fDept,
      email: fEmail, telefone: fTel, dataAdmissao: fDataAdm,
      tipoContrato: fContrato,
      morada: { rua: fRua, numero: fNumero, andar: fAndar, codigoPostal: fCP, localidade: fLocalidade, distrito: fDistrito },
      documentos: [],
    }
    updateColaboradores(prev => [...prev, novo])
    resetFormColab()
    setColabView('list')
  }

  function excluirColaborador(id: string) {
    updateColaboradores(prev => prev.filter(c => c.id !== id))
    setConfirmDeleteColab(null)
    if (selectedColab?.id === id) { setSelectedColab(null); setColabView('list') }
  }

  function adicionarDocumento() {
    setUploadErr('')
    if (!uploadNome || !uploadFile) { setUploadErr('Introduza um nome e selecione um ficheiro.'); return }
    if (!selectedColab) return
    const doc: Documento = {
      id: Date.now().toString(), nome: uploadNome, tipo: uploadTipo,
      fileName: uploadFile.name, dataUpload: new Date().toISOString().split('T')[0], fileObj: uploadFile,
    }
    const updated: Colaborador = { ...selectedColab, documentos: [...selectedColab.documentos, doc] }
    setSelectedColab(updated)
    updateColaboradores(prev => prev.map(c => c.id === selectedColab.id ? updated : c))
    setUploadNome(''); setUploadFile(null); setUploadTipo('pessoal')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removerDocumento(docId: string) {
    if (!selectedColab) return
    const updated: Colaborador = { ...selectedColab, documentos: selectedColab.documentos.filter(d => d.id !== docId) }
    setSelectedColab(updated)
    updateColaboradores(prev => prev.map(c => c.id === selectedColab.id ? updated : c))
  }

  function abrirDocumento(doc: Documento) {
    if (!doc.fileObj) return
    const url = URL.createObjectURL(doc.fileObj)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  const forca = forcaSenha(regPass)
  const forcaCores = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a']
  const forcaLabels = ['', 'Muito fraca', 'Fraca', 'Razoável', 'Forte', 'Muito forte']

  function StepIndicator() {
    return (
      <div style={s.steps}>
        {([{ n: 1, label: 'Empresa' }, { n: 2, label: 'Administrador' }, { n: 3, label: 'Acesso' }] as const).map((st, i) => (
          <div key={st.n} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: regStep === st.n ? '#2563eb' : regStep > st.n ? '#16a34a' : '#94a3b8' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: `1px solid ${regStep === st.n ? '#2563eb' : regStep > st.n ? '#16a34a' : '#e2e8f0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 500, background: regStep === st.n ? '#eff6ff' : regStep > st.n ? '#f0fdf4' : 'transparent' }}>
                {regStep > st.n ? '✓' : st.n}
              </div>
              <span>{st.label}</span>
            </div>
            {i < 2 && <div style={{ width: '24px', height: '1px', background: '#e2e8f0', margin: '0 4px' }} />}
          </div>
        ))}
      </div>
    )
  }

  function AlertBox() {
    if (!alertState) return null
    const style = alertState.type === 'err' ? s.alertErr : alertState.type === 'ok' ? s.alertOk : s.alertInfo
    return <div style={style}>{alertState.msg}</div>
  }

  function countryFlag(code: string) { return countryList.find(c => c.code === code)?.flag ?? '' }
  function countryName(code: string) { return countryList.find(c => c.code === code)?.name ?? code }

  // ===== LOGIN =====
  if (screen === 'login') return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.logoArea}>
          <div style={s.logoIcon}>👥</div>
          <p style={s.title}>RH Gestão</p>
          <p style={s.sub}>Aceda à sua conta de administrador</p>
        </div>
        <AlertBox />
        <div style={s.field}>
          <label style={s.label}>E-mail</label>
          <input style={s.input} type="email" placeholder="admin@empresa.pt" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Senha do sistema</label>
          <div style={s.passWrap}>
            <input style={{ ...s.input, paddingRight: '36px' }} type={showPass ? 'text' : 'password'} placeholder="••••••••" value={loginPass} onChange={e => setLoginPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && doLogin()} />
            <button style={s.eyeBtn} onClick={() => setShowPass(!showPass)}>{showPass ? '🙈' : '👁'}</button>
          </div>
        </div>
        <button style={s.btnMain} onClick={doLogin}>Entrar</button>
        <button style={s.btnGoogle} onClick={triggerGoogle}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.706 17.64 9.2z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
          </svg>
          Entrar com Google
        </button>
        <div style={s.divider}>
          <div style={s.dividerLine} /><span style={s.dividerTxt}>ou</span><div style={s.dividerLine} />
        </div>
        <button style={s.btnRegister} onClick={() => goTo('register')}>
          🏢 Cadastrar nova empresa
        </button>
        <p style={s.msgCenter}>
          <button style={s.link} onClick={() => goTo('forgot')}>Esqueci a senha</button>
          {'  ·  '}
          <button style={s.link} onClick={() => goTo('companies')}>Trocar empresa</button>
        </p>
      </div>
    </div>
  )

  // ===== FORGOT =====
  if (screen === 'forgot') return (
    <div style={s.wrap}>
      <div style={s.card}>
        <button style={s.backBtn} onClick={() => goTo('login')}>← Voltar</button>
        <div style={s.logoArea}>
          <div style={s.logoIcon}>✉️</div>
          <p style={s.title}>Recuperar acesso</p>
          <p style={s.sub}>Enviaremos um link de redefinição para o seu e-mail</p>
        </div>
        <AlertBox />
        <div style={s.field}>
          <label style={s.label}>E-mail cadastrado</label>
          <input style={s.input} type="email" placeholder="admin@empresa.pt" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} />
        </div>
        <button style={s.btnMain} onClick={doForgot}>Enviar link de recuperação</button>
      </div>
    </div>
  )

  // ===== REGISTER =====
  if (screen === 'register') return (
    <div style={s.wrap}>
      <div style={s.card}>
        <button style={s.backBtn} onClick={() => goTo('login')}>← Voltar ao login</button>
        <div style={s.logoArea}>
          <div style={s.logoIcon}>🏢</div>
          <p style={s.title}>Cadastrar empresa</p>
        </div>
        <StepIndicator />
        <AlertBox />

        {regStep === 1 && (
          <>
            <p style={s.sectionLabel}>País e morada</p>
            <div style={s.field}>
              <label style={s.label}>País *</label>
              <CountryPicker value={regCountry} onChange={code => { setRegCountry(code); resetAddressFields() }} list={countryList} />
            </div>
            <div style={s.field}>
              <label style={s.label}>{cfg.postalLabel} *</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  style={{ ...(lookupState === 'ok' ? s.inputOk : lookupState === 'err' ? s.inputErr : s.input), flex: 1 }}
                  type="text" placeholder={cfg.postalPlaceholder} value={regPostal}
                  onChange={e => handlePostalChange(e.target.value)}
                  onBlur={() => { if (cfg.postalLookup) doPostalLookup() }}
                />
                {cfg.postalLookup && (
                  <button
                    style={{ height: '38px', padding: '0 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', color: '#2563eb', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    onClick={doPostalLookup}
                  >
                    {lookupState === 'loading' ? '...' : '🔍'}
                  </button>
                )}
              </div>
              {lookupState === 'ok' && <p style={s.hintOk}>✓ Morada preenchida automaticamente</p>}
              {lookupState === 'err' && <p style={s.hintErr}>Código postal não encontrado. Preencha manualmente.</p>}
              {lookupState === 'idle' && cfg.postalLookup && <p style={s.hint}>Preencha para preenchimento automático da morada</p>}
            </div>
            <div style={s.field}>
              <label style={s.label}>{cfg.streetLabel} *</label>
              <input style={lookupState === 'ok' && regStreet ? s.inputFilled : s.input} type="text" placeholder="Ex: Rua Augusta" value={regStreet} onChange={e => setRegStreet(e.target.value)} />
            </div>
            <div style={cfg.hasComplement ? s.row3 : { marginBottom: '0.875rem' }}>
              <div>
                <label style={s.label}>Número</label>
                <input style={s.input} type="text" placeholder="42" value={regNumber} onChange={e => setRegNumber(e.target.value)} />
              </div>
              {cfg.hasComplement && (
                <div>
                  <label style={s.label}>{cfg.complementLabel}</label>
                  <input style={s.input} type="text" placeholder="2º Dto" value={regComplement} onChange={e => setRegComplement(e.target.value)} />
                </div>
              )}
            </div>
            <div style={s.row2}>
              <div>
                <label style={s.label}>{cfg.cityLabel} *</label>
                <input style={lookupState === 'ok' && regCity ? s.inputFilled : s.input} type="text" placeholder={cfg.cityLabel} value={regCity} onChange={e => setRegCity(e.target.value)} />
              </div>
              <div>
                <label style={s.label}>{cfg.stateLabel} *</label>
                <input style={lookupState === 'ok' && regStateAddr ? s.inputFilled : s.input} type="text" placeholder={cfg.stateLabel} value={regStateAddr} onChange={e => setRegStateAddr(e.target.value)} />
              </div>
            </div>
            {cfg.regionLabel !== '' && (
              <div style={s.field}>
                <label style={s.label}>{cfg.regionLabel}</label>
                <input style={lookupState === 'ok' && regRegion ? s.inputFilled : s.input} type="text" placeholder={cfg.regionLabel} value={regRegion} onChange={e => setRegRegion(e.target.value)} />
              </div>
            )}
            <p style={{ ...s.sectionLabel, marginTop: '12px' }}>Dados da empresa</p>
            <div style={s.field}>
              <label style={s.label}>Nome da empresa *</label>
              <input style={s.input} type="text" placeholder="Ex: Clínica Saúde Lisboa, Lda." value={regCompany} onChange={e => setRegCompany(e.target.value)} />
            </div>
            <div style={s.row2}>
              <div>
                <label style={s.label}>{cfg.taxLabel} *</label>
                <input style={s.input} type="text" placeholder={cfg.taxLabel} value={regTaxId} onChange={e => setRegTaxId(e.target.value)} />
              </div>
              <div>
                <label style={s.label}>Telefone *</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <span style={{ height: '38px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc', color: '#64748b', fontSize: '12px', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>{cfgPhone}</span>
                  <input style={{ ...s.input, flex: 1 }} type="tel" placeholder="21 000 0000" value={regTelNum} onChange={e => setRegTelNum(e.target.value)} />
                </div>
              </div>
            </div>
            <button style={s.btnMain} onClick={regNext1}>Continuar →</button>
          </>
        )}

        {regStep === 2 && (
          <>
            <p style={s.sectionLabel}>Dados do administrador</p>
            <div style={s.field}>
              <label style={s.label}>Nome completo *</label>
              <input style={s.input} type="text" placeholder="Ex: Maria Silva" value={regNome} onChange={e => setRegNome(e.target.value)} />
            </div>
            <div style={s.field}>
              <label style={s.label}>E-mail *</label>
              <input style={s.input} type="email" placeholder="admin@empresa.pt" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
              <p style={s.hint}>Usado para recuperação de acesso</p>
            </div>
            <button style={s.btnMain} onClick={regNext2}>Continuar →</button>
            <button style={s.btnOutline} onClick={() => { setAlertState(null); setRegStep(1) }}>← Voltar</button>
          </>
        )}

        {/* MODAL TERMOS / PRIVACIDADE */}
        {modal && (
          <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
                <p style={{ fontWeight: 600, fontSize: '15px', color: '#0f172a', margin: 0 }}>
                  {modal === 'terms' ? '📋 Termos de Uso' : '🔒 Política de Privacidade'}
                </p>
                <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#94a3b8', lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ overflowY: 'auto', padding: '1.25rem 1.5rem', fontSize: '13px', color: '#475569', lineHeight: '1.7' }}>
                {modal === 'terms' ? (
                  <>
                    <p><strong>1. Aceitação dos Termos</strong></p>
                    <p>Ao criar uma conta na plataforma RH Gestão, o utilizador declara ter lido, compreendido e aceite os presentes Termos de Uso. Caso não concorde com alguma das condições aqui descritas, deverá abster-se de utilizar o serviço.</p>
                    <p><strong>2. Descrição do Serviço</strong></p>
                    <p>O RH Gestão é uma plataforma de gestão de recursos humanos destinada a empresas. Permite o registo de colaboradores, gestão de ausências, processamento salarial e outras funcionalidades de RH.</p>
                    <p><strong>3. Responsabilidades do Utilizador</strong></p>
                    <p>O utilizador é responsável por manter as suas credenciais de acesso em segurança, por toda a atividade realizada na sua conta e por garantir que os dados inseridos são verdadeiros e atualizados.</p>
                    <p><strong>4. Propriedade Intelectual</strong></p>
                    <p>Todo o conteúdo, código e design da plataforma são propriedade exclusiva da RH Gestão. É proibida a reprodução, distribuição ou modificação sem autorização prévia por escrito.</p>
                    <p><strong>5. Suspensão e Encerramento</strong></p>
                    <p>A RH Gestão reserva-se o direito de suspender ou encerrar contas que violem os presentes Termos, sem aviso prévio e sem responsabilidade de qualquer espécie.</p>
                    <p><strong>6. Alterações aos Termos</strong></p>
                    <p>Reservamo-nos o direito de atualizar estes Termos a qualquer momento. As alterações entram em vigor após publicação na plataforma. O uso continuado do serviço implica a aceitação das novas condições.</p>
                    <p><strong>7. Lei Aplicável</strong></p>
                    <p>Os presentes Termos são regidos pela legislação portuguesa, sendo competente para dirimir eventuais litígios o Tribunal da Comarca de Lisboa.</p>
                  </>
                ) : (
                  <>
                    <p><strong>1. Responsável pelo Tratamento</strong></p>
                    <p>A RH Gestão é a entidade responsável pelo tratamento dos dados pessoais recolhidos através desta plataforma, comprometendo-se a protegê-los nos termos do Regulamento Geral sobre a Proteção de Dados (RGPD — Regulamento UE 2016/679).</p>
                    <p><strong>2. Dados Recolhidos</strong></p>
                    <p>Recolhemos os seguintes dados: nome, endereço de e-mail, NIF/número de identificação fiscal, dados de contacto, morada e dados relativos à empresa registada. Os dados são recolhidos diretamente pelo utilizador no momento do registo.</p>
                    <p><strong>3. Finalidade do Tratamento</strong></p>
                    <p>Os dados são utilizados exclusivamente para: prestação dos serviços contratados, gestão da conta do utilizador, cumprimento de obrigações legais e, com consentimento, envio de comunicações sobre o serviço.</p>
                    <p><strong>4. Base Legal</strong></p>
                    <p>O tratamento assenta no consentimento expresso do titular (art. 6.º, n.º 1, al. a) do RGPD) e na execução do contrato de prestação de serviços (art. 6.º, n.º 1, al. b)).</p>
                    <p><strong>5. Conservação dos Dados</strong></p>
                    <p>Os dados são conservados pelo período necessário à prestação do serviço e ao cumprimento de obrigações legais, sendo eliminados após o encerramento da conta, salvo obrigação legal de retenção.</p>
                    <p><strong>6. Direitos do Titular</strong></p>
                    <p>O titular dos dados tem direito a aceder, retificar, apagar, limitar o tratamento, opor-se ao tratamento e à portabilidade dos seus dados. Para exercer estes direitos, contacte: <strong>privacidade@rhgestao.pt</strong></p>
                    <p><strong>7. Segurança</strong></p>
                    <p>Adotamos medidas técnicas e organizativas adequadas para proteger os dados contra acesso não autorizado, perda, destruição ou divulgação, em conformidade com o RGPD.</p>
                  </>
                )}
              </div>
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
                <button onClick={() => setModal(null)} style={{ width: '100%', height: '38px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {regStep === 3 && (
          <>
            <p style={s.sectionLabel}>Credenciais de acesso ao sistema</p>
            <div style={s.field}>
              <label style={s.label}>Criar senha *</label>
              <div style={s.passWrap}>
                <input style={{ ...s.input, paddingRight: '36px' }} type={showRegPass ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" value={regPass} onChange={e => setRegPass(e.target.value)} />
                <button style={s.eyeBtn} onClick={() => setShowRegPass(!showRegPass)}>{showRegPass ? '🙈' : '👁'}</button>
              </div>
              {regPass.length > 0 && (
                <>
                  <div style={{ height: '4px', borderRadius: '2px', background: '#e2e8f0', marginTop: '6px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '2px', width: `${(forca / 5) * 100}%`, background: forcaCores[forca], transition: 'width .3s' }} />
                  </div>
                  <p style={{ ...s.hint, color: forcaCores[forca] || '#94a3b8', marginTop: '3px' }}>{forcaLabels[forca]}</p>
                </>
              )}
              {regPass.length === 0 && <p style={s.hint}>Use maiúsculas, minúsculas, números e símbolos</p>}
            </div>
            <div style={s.field}>
              <label style={s.label}>Confirmar senha *</label>
              <div style={s.passWrap}>
                <input style={{ ...s.input, paddingRight: '36px' }} type={showRegPass2 ? 'text' : 'password'} placeholder="Repita a senha" value={regPass2} onChange={e => setRegPass2(e.target.value)} />
                <button style={s.eyeBtn} onClick={() => setShowRegPass2(!showRegPass2)}>{showRegPass2 ? '🙈' : '👁'}</button>
              </div>
            </div>
            <div style={s.rgpdBox}>
              <p style={{ fontSize: '12px', fontWeight: 500, color: '#0f172a', marginBottom: '8px' }}>
                {cfg.isEU ? '🛡 Proteção de dados — RGPD' : '🛡 Proteção de dados'}
              </p>
              <div style={s.checkRow}>
                <input type="checkbox" id="chk-terms" checked={chkTerms} onChange={e => setChkTerms(e.target.checked)} style={{ marginTop: '2px', flexShrink: 0 }} />
                <label htmlFor="chk-terms" style={{ fontSize: '12px', color: '#475569', lineHeight: '1.5', cursor: 'pointer' }}>
                  Li e aceito os{' '}
                  <button type="button" onClick={e => { e.preventDefault(); setModal('terms') }} style={{ color: '#2563eb', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>Termos de Uso</button>
                  {' '}e a{' '}
                  <button type="button" onClick={e => { e.preventDefault(); setModal('privacy') }} style={{ color: '#2563eb', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>Política de Privacidade</button> *
                </label>
              </div>
              <div style={s.checkRow}>
                <input type="checkbox" id="chk-data" checked={chkData} onChange={e => setChkData(e.target.checked)} style={{ marginTop: '2px', flexShrink: 0 }} />
                <label htmlFor="chk-data" style={{ fontSize: '12px', color: '#475569', lineHeight: '1.5', cursor: 'pointer' }}>
                  {cfg.isEU
                    ? 'Consinto o tratamento dos dados nos termos do RGPD (Regulamento UE 2016/679) *'
                    : 'Consinto o tratamento dos meus dados para fins de gestão de recursos humanos *'
                  }
                </label>
              </div>
              <div style={{ ...s.checkRow, marginBottom: 0 }}>
                <input type="checkbox" id="chk-comm" checked={chkComm} onChange={e => setChkComm(e.target.checked)} style={{ marginTop: '2px', flexShrink: 0 }} />
                <label htmlFor="chk-comm" style={{ fontSize: '12px', color: '#475569', lineHeight: '1.5', cursor: 'pointer' }}>
                  Aceito receber comunicações sobre o serviço por e-mail (opcional)
                </label>
              </div>
            </div>
            <button style={s.btnMain} onClick={doRegister}>Criar conta</button>
            <button style={s.btnOutline} onClick={() => { setAlertState(null); setRegStep(2) }}>← Voltar</button>
          </>
        )}
      </div>
    </div>
  )

  // ===== COMPANIES =====
  if (screen === 'companies') return (
    <div style={s.wrap}>
      <div style={s.card}>
        <button style={s.backBtn} onClick={() => goTo('login')}>← Voltar</button>
        <div style={s.logoArea}>
          <div style={s.logoIcon}>🏘️</div>
          <p style={s.title}>Minhas empresas</p>
          <p style={s.sub}>Selecione a empresa para aceder</p>
        </div>
        <div>
          {companies.map((c, i) => (
            <div key={i} style={{ ...s.companyItem, ...(c === selectedCompany ? { borderColor: '#2563eb', background: '#eff6ff' } : {}) }} onClick={() => { setSelectedCompany(c); setLoginEmail(c.email); goTo('login') }}>
              <div style={s.companyAvatar}>{c.name.charAt(0)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</p>
                <p style={{ fontSize: '11px', color: '#64748b' }}>{countryFlag(c.country)} {c.email}</p>
              </div>
              {c === selectedCompany && <span style={{ color: '#2563eb', fontSize: '16px' }}>✓</span>}
            </div>
          ))}
        </div>
        <button style={s.btnOutline} onClick={() => goTo('register')}>+ Adicionar nova empresa</button>
      </div>
    </div>
  )

  // ===== SUCCESS =====
  if (screen === 'success') return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.logoArea}>
          <div style={{ ...s.logoIcon, background: '#f0fdf4' }}>✅</div>
          <p style={s.title}>{successTitle}</p>
          <p style={s.sub}>{successSub}</p>
        </div>
        <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '1rem', textAlign: 'center', marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '12px', color: '#64748b' }}>Empresa ativa</p>
          <p style={{ fontSize: '15px', fontWeight: 500, color: '#0f172a', marginTop: '4px' }}>{selectedCompany.name}</p>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{countryFlag(selectedCompany.country)} {countryName(selectedCompany.country)}</p>
        </div>
        <button style={s.btnMain} onClick={() => { setColabView('list'); setSelectedColab(null); goTo('dashboard') }}>
          Ir para o dashboard →
        </button>
      </div>
    </div>
  )

  // ===== DASHBOARD =====
  if (screen === 'dashboard') return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#0f172a', color: '#fff', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>👥</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>RH Gestão</span>
            <span style={{ color: '#475569', fontSize: '13px' }}>|</span>
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>{selectedCompany.name}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>👤 {selectedCompany.admin}</span>
          <button
            onClick={() => { setColabView('list'); setSelectedColab(null); goTo('login') }}
            style={{ height: '32px', padding: '0 12px', background: 'transparent', border: '1px solid #334155', borderRadius: '6px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer' }}
          >
            Sair
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 1.5rem' }}>
        <button style={{ height: '44px', padding: '0 16px', background: 'none', border: 'none', borderBottom: '2px solid #2563eb', color: '#2563eb', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
          👥 Colaboradores
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '1.5rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

          {/* Confirm delete modal */}
          {confirmDeleteColab && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '380px' }}>
                <p style={{ fontWeight: 600, fontSize: '15px', color: '#0f172a', marginTop: 0, marginBottom: '8px' }}>Eliminar colaborador?</p>
                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '1.5rem' }}>
                  Esta ação não pode ser desfeita. Todos os documentos associados serão perdidos.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setConfirmDeleteColab(null)} style={{ flex: 1, height: '38px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#475569', fontSize: '13px', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={() => excluirColaborador(confirmDeleteColab!)} style={{ flex: 1, height: '38px', background: '#ef4444', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── LIST VIEW ── */}
          {colabView === 'list' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a', margin: 0 }}>Colaboradores</h2>
                  <p style={{ fontSize: '13px', color: '#64748b', marginTop: '3px', marginBottom: 0 }}>
                    {colaboradores.length} {colaboradores.length === 1 ? 'colaborador' : 'colaboradores'}
                  </p>
                </div>
                <button
                  onClick={() => { resetFormColab(); setColabView('form') }}
                  style={{ height: '38px', padding: '0 16px', background: '#2563eb', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
                >
                  + Adicionar colaborador
                </button>
              </div>

              {colaboradores.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '3rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>👤</div>
                  <p style={{ fontSize: '15px', fontWeight: 500, color: '#0f172a', marginBottom: '4px' }}>Nenhum colaborador</p>
                  <p style={{ fontSize: '13px', color: '#64748b' }}>Adicione o primeiro colaborador para começar.</p>
                </div>
              ) : (
                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 110px 150px 90px', gap: '12px', padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 500, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    <span>Nome</span><span>Cargo</span><span>Departamento</span><span>Admissão</span><span>Contrato</span><span></span>
                  </div>
                  {colaboradores.map((c, i) => (
                    <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 110px 150px 90px', gap: '12px', padding: '14px 16px', borderBottom: i < colaboradores.length - 1 ? '1px solid #f1f5f9' : 'none', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => { setSelectedColab(c); setColabDetailTab('dados'); setColabView('detail') }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: '#2563eb', flexShrink: 0 }}>
                          {c.nome.charAt(0)}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#2563eb' }}>{c.nome}</span>
                      </div>
                      <span style={{ fontSize: '13px', color: '#475569' }}>{c.cargo}</span>
                      <span style={{ fontSize: '13px', color: '#475569' }}>{c.departamento}</span>
                      <span style={{ fontSize: '13px', color: '#475569' }}>{c.dataAdmissao}</span>
                      <span style={{ fontSize: '12px', color: '#475569', background: '#f1f5f9', borderRadius: '20px', padding: '3px 10px', whiteSpace: 'nowrap' as const, display: 'inline-block' }}>
                        {CONTRATO_LABELS[c.tipoContrato]}
                      </span>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button onClick={() => { setSelectedColab(c); setColabDetailTab('dados'); setColabView('detail') }} style={{ height: '30px', padding: '0 10px', background: '#eff6ff', border: 'none', borderRadius: '6px', color: '#2563eb', fontSize: '12px', cursor: 'pointer' }}>
                          Ver
                        </button>
                        <button onClick={() => setConfirmDeleteColab(c.id)} style={{ height: '30px', padding: '0 10px', background: '#fef2f2', border: 'none', borderRadius: '6px', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── FORM VIEW ── */}
          {colabView === 'form' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                <button onClick={() => setColabView('list')} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#64748b', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                  ← Voltar à lista
                </button>
                <span style={{ color: '#e2e8f0' }}>|</span>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a', margin: 0 }}>Novo colaborador</h2>
              </div>
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
                {formColabErr && <div style={s.alertErr}>{formColabErr}</div>}
                <p style={s.sectionLabel}>Dados profissionais</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '0.875rem' }}>
                  <div><label style={s.label}>Nome completo *</label><input style={s.input} type="text" placeholder="Ex: Ana Costa" value={fNome} onChange={e => setFNome(e.target.value)} /></div>
                  <div><label style={s.label}>NIF *</label><input style={s.input} type="text" placeholder="NIF" value={fNif} onChange={e => setFNif(e.target.value)} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '0.875rem' }}>
                  <div><label style={s.label}>Cargo *</label><input style={s.input} type="text" placeholder="Ex: Enfermeira" value={fCargo} onChange={e => setFCargo(e.target.value)} /></div>
                  <div><label style={s.label}>Departamento *</label><input style={s.input} type="text" placeholder="Ex: Clínica" value={fDept} onChange={e => setFDept(e.target.value)} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '0.875rem' }}>
                  <div><label style={s.label}>E-mail *</label><input style={s.input} type="email" placeholder="colaborador@empresa.pt" value={fEmail} onChange={e => setFEmail(e.target.value)} /></div>
                  <div><label style={s.label}>Telefone *</label><input style={s.input} type="tel" placeholder="+351 912 000 000" value={fTel} onChange={e => setFTel(e.target.value)} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '0.875rem' }}>
                  <div><label style={s.label}>Data de admissão *</label><input style={s.input} type="date" value={fDataAdm} onChange={e => setFDataAdm(e.target.value)} /></div>
                  <div>
                    <label style={s.label}>Tipo de contrato</label>
                    <select style={s.select} value={fContrato} onChange={e => setFContrato(e.target.value as Colaborador['tipoContrato'])}>
                      {Object.entries(CONTRATO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <p style={{ ...s.sectionLabel, marginTop: '12px' }}>Morada</p>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px', marginBottom: '0.875rem' }}>
                  <div><label style={s.label}>Rua / Avenida</label><input style={s.input} type="text" placeholder="Ex: Rua das Flores" value={fRua} onChange={e => setFRua(e.target.value)} /></div>
                  <div><label style={s.label}>Número</label><input style={s.input} type="text" placeholder="10" value={fNumero} onChange={e => setFNumero(e.target.value)} /></div>
                  <div><label style={s.label}>Andar / Fração</label><input style={s.input} type="text" placeholder="1º Esq" value={fAndar} onChange={e => setFAndar(e.target.value)} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '1.5rem' }}>
                  <div><label style={s.label}>Código Postal</label><input style={s.input} type="text" placeholder="1100-150" value={fCP} onChange={e => setFCP(e.target.value)} /></div>
                  <div><label style={s.label}>Localidade</label><input style={s.input} type="text" placeholder="Lisboa" value={fLocalidade} onChange={e => setFLocalidade(e.target.value)} /></div>
                  <div><label style={s.label}>Distrito</label><input style={s.input} type="text" placeholder="Lisboa" value={fDistrito} onChange={e => setFDistrito(e.target.value)} /></div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={adicionarColaborador} style={{ flex: 1, height: '40px', background: '#2563eb', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
                    Guardar colaborador
                  </button>
                  <button onClick={() => { resetFormColab(); setColabView('list') }} style={{ height: '40px', padding: '0 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#475569', fontSize: '13px', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── DETAIL VIEW ── */}
          {colabView === 'detail' && selectedColab && (
            <div>
              <button onClick={() => { setColabView('list'); setSelectedColab(null) }} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#64748b', cursor: 'pointer', background: 'none', border: 'none', padding: 0, marginBottom: '1.25rem' }}>
                ← Voltar à lista
              </button>

              {/* Employee header card */}
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem 1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700, color: '#2563eb', flexShrink: 0 }}>
                  {selectedColab.nome.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#0f172a', margin: '0 0 4px 0' }}>{selectedColab.nome}</h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                    {selectedColab.cargo} · {selectedColab.departamento}
                    <span style={{ marginLeft: '8px', background: '#f1f5f9', borderRadius: '20px', padding: '2px 8px', fontSize: '12px' }}>
                      {CONTRATO_LABELS[selectedColab.tipoContrato]}
                    </span>
                  </p>
                </div>
                <button onClick={() => setConfirmDeleteColab(selectedColab.id)} style={{ height: '34px', padding: '0 14px', background: '#fef2f2', border: 'none', borderRadius: '8px', color: '#ef4444', fontSize: '13px', cursor: 'pointer' }}>
                  Eliminar
                </button>
              </div>

              {/* Detail tabs + content */}
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ display: 'flex', padding: '0 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
                  {(['dados', 'documentos'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setColabDetailTab(tab)}
                      style={{ height: '44px', padding: '0 16px', background: 'none', border: 'none', borderBottom: colabDetailTab === tab ? '2px solid #2563eb' : '2px solid transparent', color: colabDetailTab === tab ? '#2563eb' : '#64748b', fontSize: '13px', fontWeight: colabDetailTab === tab ? 500 : 400, cursor: 'pointer' }}
                    >
                      {tab === 'dados' ? '📋 Dados' : `📁 Documentos (${selectedColab.documentos.length})`}
                    </button>
                  ))}
                </div>

                {/* Dados tab */}
                {colabDetailTab === 'dados' && (
                  <div style={{ padding: '1.5rem' }}>
                    <p style={s.sectionLabel}>Dados profissionais</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px 24px', marginBottom: '1.5rem' }}>
                      <InfoField label="Nome" value={selectedColab.nome} />
                      <InfoField label="NIF" value={selectedColab.nif} />
                      <InfoField label="Cargo" value={selectedColab.cargo} />
                      <InfoField label="Departamento" value={selectedColab.departamento} />
                      <InfoField label="Data de admissão" value={selectedColab.dataAdmissao} />
                      <InfoField label="Tipo de contrato" value={CONTRATO_LABELS[selectedColab.tipoContrato]} />
                    </div>
                    <p style={s.sectionLabel}>Contactos</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px 24px', marginBottom: '1.5rem' }}>
                      <InfoField label="E-mail" value={selectedColab.email} />
                      <InfoField label="Telefone" value={selectedColab.telefone} />
                    </div>
                    <p style={s.sectionLabel}>Morada</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px 24px' }}>
                      <InfoField label="Rua / Avenida" value={selectedColab.morada.rua} />
                      <InfoField label="Número" value={selectedColab.morada.numero} />
                      <InfoField label="Andar / Fração" value={selectedColab.morada.andar} />
                      <InfoField label="Código Postal" value={selectedColab.morada.codigoPostal} />
                      <InfoField label="Localidade" value={selectedColab.morada.localidade} />
                      <InfoField label="Distrito" value={selectedColab.morada.distrito} />
                    </div>
                  </div>
                )}

                {/* Documentos tab */}
                {colabDetailTab === 'documentos' && (
                  <div style={{ padding: '1.5rem' }}>
                    <p style={s.sectionLabel}>Adicionar documento</p>
                    <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1', padding: '1.25rem', marginBottom: '1.5rem' }}>
                      {uploadErr && <div style={{ ...s.alertErr, marginBottom: '10px' }}>{uploadErr}</div>}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <label style={s.label}>Nome do documento *</label>
                          <input style={s.input} type="text" placeholder="Ex: Contrato de trabalho 2024" value={uploadNome} onChange={e => setUploadNome(e.target.value)} />
                        </div>
                        <div>
                          <label style={s.label}>Tipo</label>
                          <select style={s.select} value={uploadTipo} onChange={e => setUploadTipo(e.target.value as Documento['tipo'])}>
                            {Object.entries(DOC_TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{DOC_TIPO_ICONS[k]} {v}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                          <label style={s.label}>Ficheiro *</label>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button onClick={() => fileInputRef.current?.click()} style={{ height: '38px', padding: '0 14px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#475569', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                              📎 Escolher ficheiro
                            </button>
                            <span style={{ fontSize: '13px', color: uploadFile ? '#0f172a' : '#94a3b8' }}>
                              {uploadFile ? uploadFile.name : 'Nenhum ficheiro selecionado'}
                            </span>
                            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
                          </div>
                        </div>
                        <button onClick={adicionarDocumento} style={{ height: '38px', padding: '0 18px', background: '#2563eb', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                          Adicionar
                        </button>
                      </div>
                    </div>

                    {selectedColab.documentos.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8' }}>
                        <p style={{ fontSize: '32px', marginBottom: '8px' }}>📁</p>
                        <p style={{ fontSize: '13px' }}>Nenhum documento adicionado ainda.</p>
                      </div>
                    ) : (
                      <>
                        <p style={s.sectionLabel}>Documentos ({selectedColab.documentos.length})</p>
                        {selectedColab.documentos.map(doc => (
                          <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '22px', flexShrink: 0 }}>{DOC_TIPO_ICONS[doc.tipo]}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: '13px', fontWeight: 500, color: '#0f172a', margin: '0 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nome}</p>
                              <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>
                                {DOC_TIPO_LABELS[doc.tipo]} · {doc.fileName} · {doc.dataUpload}
                              </p>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                              {doc.fileObj && (
                                <button onClick={() => abrirDocumento(doc)} style={{ height: '30px', padding: '0 10px', background: '#eff6ff', border: 'none', borderRadius: '6px', color: '#2563eb', fontSize: '12px', cursor: 'pointer' }}>
                                  Abrir
                                </button>
                              )}
                              <button onClick={() => removerDocumento(doc.id)} style={{ height: '30px', padding: '0 10px', background: '#fef2f2', border: 'none', borderRadius: '6px', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}>
                                Remover
                              </button>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )

  return null
}
