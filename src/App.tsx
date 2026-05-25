import { useState, useEffect, useRef } from 'react'

declare global { interface Window { google: any } }

// ── TYPES ──────────────────────────────────────────────────────────────────
interface Company {
  name: string; taxId: string; email: string; pass: string; admin: string; tel: string
  country: string
  address: { street: string; number: string; complement: string; postalCode: string; city: string; region: string; state: string }
  dataConsent: boolean; consentDate: string
}
interface CountryItem { code: string; name: string; flag: string; phone: string }
interface CulturalConfig {
  taxLabel: string; postalLabel: string; postalPlaceholder: string
  postalMask: ((v: string) => string) | null; postalLookup: boolean
  streetLabel: string; cityLabel: string; regionLabel: string; stateLabel: string
  hasComplement: boolean; complementLabel: string
}
interface Documento { id: string; nome: string; fileName: string; dataUpload: string; fileObj?: File }
interface Colaborador {
  id: string; nome: string; nif: string; cargo: string; departamento: string
  email: string; telefone: string; dataAdmissao: string
  tipoContrato: 'sem-termo' | 'termo-certo' | 'termo-incerto' | 'prestacao-servicos' | 'estagio'
  morada: { rua: string; numero: string; andar: string; codigoPostal: string; localidade: string; distrito: string }
  documentos: Documento[]
  ativo: boolean; dataSaida?: string; motivoSaida?: string
}
interface Theme {
  bg: string; card: string; border: string; text: string; textMuted: string
  nav: string; navText: string; btn: string; btnText: string; input: string
}

// ── CULTURAL CONFIG ────────────────────────────────────────────────────────
const EU_COUNTRIES = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'])
const DEFAULT_CULTURAL: CulturalConfig = {
  taxLabel: 'Tax ID', postalLabel: 'Postal Code', postalPlaceholder: '',
  postalMask: null, postalLookup: true,
  streetLabel: 'Street', cityLabel: 'City', stateLabel: 'State / Province', regionLabel: '',
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

// ── COLABORADORES CONSTANTS ───────────────────────────────────────────────
const CONTRATO_LABELS: Record<string, string> = {
  'sem-termo': 'Sem Termo', 'termo-certo': 'Termo Certo', 'termo-incerto': 'Termo Incerto',
  'prestacao-servicos': 'Prestação de Serviços', 'estagio': 'Estágio',
}
const MOTIVO_SAIDA = [
  'Rescisão por iniciativa do trabalhador',
  'Rescisão por iniciativa da entidade empregadora',
  'Fim de contrato', 'Reforma', 'Falecimento', 'Outro',
]
const ITEMS_PER_PAGE = 10

function validarFicheiroDoc(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!['pdf','jpg','jpeg','png'].includes(ext))
    return 'Apenas PDF e imagens (JPG, JPEG, PNG) são aceites.'
  return null
}
function iconeDoc(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return '📄'
  if (['jpg','jpeg','png'].includes(ext)) return '🖼️'
  return '📎'
}

// ── THEMES ────────────────────────────────────────────────────────────────
const THEMES: Record<string, Theme> = {
  classico:  { bg:'#f1f5f9', card:'#ffffff', border:'#e2e8f0', text:'#0f172a', textMuted:'#64748b', nav:'#0f172a', navText:'#f8fafc', btn:'#2563eb', btnText:'#ffffff', input:'#ffffff' },
  oceano:    { bg:'#e0f7fa', card:'#f0fbff', border:'#b2ebf2', text:'#003d52', textMuted:'#0077a0', nav:'#005f78', navText:'#e0f7fa', btn:'#0097a7', btnText:'#ffffff', input:'#f0fbff' },
  natural:   { bg:'#f1faf3', card:'#ffffff', border:'#c8e6c9', text:'#1b5e20', textMuted:'#388e3c', nav:'#2e7d32', navText:'#f1faf3', btn:'#388e3c', btnText:'#ffffff', input:'#ffffff' },
  escuro:    { bg:'#1e293b', card:'#334155', border:'#475569', text:'#f1f5f9', textMuted:'#94a3b8', nav:'#0f172a', navText:'#e2e8f0', btn:'#7c3aed', btnText:'#ffffff', input:'#293548' },
  moderno:   { bg:'#f5f3ff', card:'#ffffff', border:'#ddd6fe', text:'#4c1d95', textMuted:'#7c3aed', nav:'#4c1d95', navText:'#f5f3ff', btn:'#7c3aed', btnText:'#ffffff', input:'#ffffff' },
  executivo: { bg:'#f3f4f6', card:'#ffffff', border:'#d1d5db', text:'#111827', textMuted:'#6b7280', nav:'#1f2937', navText:'#f9fafb', btn:'#374151', btnText:'#ffffff', input:'#ffffff' },
}
const THEME_LABELS: Record<string, string> = {
  classico:'Clássico', oceano:'Oceano', natural:'Natural', escuro:'Escuro', moderno:'Moderno', executivo:'Executivo',
}

// ── FALLBACK COUNTRIES ────────────────────────────────────────────────────
const FALLBACK_COUNTRIES: CountryItem[] = [
  { code:'PT', name:'Portugal',       flag:'🇵🇹', phone:'+351' },
  { code:'BR', name:'Brasil',         flag:'🇧🇷', phone:'+55'  },
  { code:'AO', name:'Angola',         flag:'🇦🇴', phone:'+244' },
  { code:'MZ', name:'Moçambique',     flag:'🇲🇿', phone:'+258' },
  { code:'CV', name:'Cabo Verde',     flag:'🇨🇻', phone:'+238' },
  { code:'ES', name:'Espanha',        flag:'🇪🇸', phone:'+34'  },
  { code:'FR', name:'França',         flag:'🇫🇷', phone:'+33'  },
  { code:'DE', name:'Alemanha',       flag:'🇩🇪', phone:'+49'  },
  { code:'GB', name:'Reino Unido',    flag:'🇬🇧', phone:'+44'  },
  { code:'US', name:'Estados Unidos', flag:'🇺🇸', phone:'+1'   },
  { code:'CA', name:'Canadá',         flag:'🇨🇦', phone:'+1'   },
]

// ── HELPERS ───────────────────────────────────────────────────────────────
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
      const cep = cp.replace(/\D/g,'')
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
    return { city: a.city||a.town||a.village||a.municipality||a.county||'', state: a.state||a.county||'', region: a.suburb||a.neighbourhood||a.district||'', street: a.road||'' }
  } catch { /**/ }
  return null
}

// ── INITIAL DATA ──────────────────────────────────────────────────────────
const initialCompanies: Company[] = [{
  name: 'Clínica Saúde Lisboa, Lda.', taxId: '500123456', email: 'admin@clinica.pt', pass: 'Admin@2024',
  admin: 'Maria Silva', tel: '+351 21 000 0000', country: 'PT',
  address: { street: 'Rua Augusta', number: '42', complement: '2º Dto', postalCode: '1100-150', city: 'Lisboa', region: '', state: 'Lisboa' },
  dataConsent: true, consentDate: '2024-01-10',
}]
const initialAllColaboradores: Record<string, Colaborador[]> = {
  'admin@clinica.pt': [
    { id:'c1', nome:'Ana Costa', nif:'123456789', cargo:'Enfermeira', departamento:'Clínica', email:'ana.costa@clinica.pt', telefone:'+351 912 000 001', dataAdmissao:'2022-03-01', tipoContrato:'sem-termo', ativo:true, morada:{ rua:'Rua das Flores', numero:'10', andar:'1º Esq', codigoPostal:'1200-192', localidade:'Lisboa', distrito:'Lisboa' }, documentos:[] },
    { id:'c2', nome:'Bruno Ferreira', nif:'987654321', cargo:'Rececionista', departamento:'Administrativo', email:'bruno.ferreira@clinica.pt', telefone:'+351 912 000 002', dataAdmissao:'2023-06-15', tipoContrato:'termo-certo', ativo:true, morada:{ rua:'Av. da Liberdade', numero:'200', andar:'3º Dto', codigoPostal:'1250-147', localidade:'Lisboa', distrito:'Lisboa' }, documentos:[] },
  ],
}

// ── BASE STYLES (layout / non-colour) ─────────────────────────────────────
const s = {
  wrap:    { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'1.5rem', fontFamily:'system-ui, sans-serif' } as React.CSSProperties,
  card:    { border:'1px solid #e2e8f0', borderRadius:'16px', padding:'2rem', width:'100%', maxWidth:'440px' } as React.CSSProperties,
  logoArea:{ textAlign:'center' as const, marginBottom:'1.75rem' },
  logoIcon:{ width:'48px', height:'48px', borderRadius:'12px', background:'#eff6ff', display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:'10px', fontSize:'24px' },
  field:   { marginBottom:'0.875rem' },
  row2:    { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'0.875rem' },
  row3:    { display:'grid', gridTemplateColumns:'2fr 1fr', gap:'10px', marginBottom:'0.875rem' },
  passWrap:{ position:'relative' as const },
  eyeBtn:  { position:'absolute' as const, right:'8px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', display:'flex', padding:0 },
  steps:   { display:'flex', alignItems:'center', justifyContent:'center', gap:'4px', marginBottom:'1.5rem' },
  checkRow:{ display:'flex', alignItems:'flex-start', gap:'8px', marginBottom:'6px' },
  msgCenter:{ fontSize:'13px', textAlign:'center' as const, marginTop:'0.875rem' },
  divider: { display:'flex', alignItems:'center', gap:'8px', margin:'1rem 0' },
  alertErr:{ padding:'10px 12px', borderRadius:'8px', fontSize:'12px', marginBottom:'1rem', background:'#fef2f2', color:'#b91c1c', border:'1px solid #fecaca' },
  alertOk: { padding:'10px 12px', borderRadius:'8px', fontSize:'12px', marginBottom:'1rem', background:'#f0fdf4', color:'#15803d', border:'1px solid #bbf7d0' },
  alertInfo:{ padding:'10px 12px', borderRadius:'8px', fontSize:'12px', marginBottom:'1rem', background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe' },
}

type Screen = 'login' | 'forgot' | 'register' | 'companies' | 'success' | 'dashboard'
type RegStep = 1 | 2 | 3
type LookupState = 'idle' | 'loading' | 'ok' | 'err'

// ── COUNTRY PICKER ────────────────────────────────────────────────────────
function CountryPicker({ value, onChange, list, inputStyle }: { value: string; onChange: (c: string) => void; list: CountryItem[]; inputStyle?: React.CSSProperties }) {
  const [search, setSearch] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const selected = list.find(c => c.code === value)
  const filtered = search ? list.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().startsWith(search.toLowerCase())) : list
  useEffect(() => { setHi(0) }, [search])
  useEffect(() => {
    function h(e: MouseEvent) { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) { setOpen(false); setSearch(null) } }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  useEffect(() => { if (!listRef.current) return; (listRef.current.children[hi] as HTMLElement|undefined)?.scrollIntoView({ block:'nearest' }) }, [hi])
  function select(code: string) { onChange(code); setOpen(false); setSearch(null) }
  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) { if (e.key==='ArrowDown'||e.key==='Enter') { setOpen(true); setSearch('') }; return }
    if (e.key==='ArrowDown') { e.preventDefault(); setHi(i=>Math.min(i+1,filtered.length-1)) }
    else if (e.key==='ArrowUp') { e.preventDefault(); setHi(i=>Math.max(i-1,0)) }
    else if (e.key==='Enter') { e.preventDefault(); if (filtered[hi]) select(filtered[hi].code) }
    else if (e.key==='Escape') { setOpen(false); setSearch(null) }
  }
  const displayVal = search !== null ? search : (selected ? `${selected.flag} ${selected.name}` : '')
  const base: React.CSSProperties = { width:'100%', padding:'0 28px 0 10px', height:'38px', border:'1px solid #cbd5e1', borderRadius:'8px', fontSize:'13px', outline:'none', boxSizing:'border-box', cursor: search===null?'pointer':'text', ...inputStyle }
  return (
    <div ref={wrapRef} style={{ position:'relative' }}>
      <div style={{ position:'relative' }}>
        <input style={base} value={displayVal} placeholder="Selecione um país..." onChange={e=>{setSearch(e.target.value);setOpen(true);setHi(0)}} onFocus={()=>{setSearch('');setOpen(true)}} onKeyDown={onKeyDown} />
        <span style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', fontSize:'10px', pointerEvents:'none', color:'#94a3b8' }}>▼</span>
      </div>
      {open && (
        <div ref={listRef} style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:200, background:'#fff', border:'1px solid #cbd5e1', borderRadius:'8px', boxShadow:'0 4px 16px rgba(0,0,0,.12)', maxHeight:'220px', overflowY:'auto' }}>
          {filtered.length===0
            ? <div style={{ padding:'10px 12px', fontSize:'13px', color:'#94a3b8' }}>Nenhum país encontrado</div>
            : filtered.map((c,i) => (
              <div key={c.code} onMouseDown={e=>{e.preventDefault();select(c.code)}} onMouseEnter={()=>setHi(i)}
                style={{ padding:'8px 12px', fontSize:'13px', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', background:i===hi?'#eff6ff':c.code===value?'#f0fdf4':'transparent', color:i===hi?'#2563eb':'#0f172a' }}>
                <span>{c.flag}</span><span style={{ flex:1 }}>{c.name}</span><span style={{ fontSize:'11px', color:'#94a3b8' }}>{c.phone}</span>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

function InfoField({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p style={{ fontSize:'11px', fontWeight:600, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', margin:'0 0 3px 0' }}>{label}</p>
      <p style={{ fontSize:'14px', color: color||'#0f172a', margin:0, fontWeight:500 }}>{value||'—'}</p>
    </div>
  )
}

// ── APP ───────────────────────────────────────────────────────────────────
export default function App() {

  // ── Screen
  const [screen, setScreen] = useState<Screen>('login')
  const [companies, setCompanies] = useState<Company[]>(initialCompanies)
  const [selectedCompany, setSelectedCompany] = useState<Company>(initialCompanies[0])
  const [alertState, setAlertState] = useState<{type:'err'|'ok'|'info';msg:string}|null>(null)

  // ── Theme (persisted)
  const [themeName, setThemeName] = useState<string>(() => localStorage.getItem('rh-theme') ?? 'classico')
  const [theme, setTheme] = useState<Theme>(() => {
    const tn = localStorage.getItem('rh-theme') ?? 'classico'
    const raw = localStorage.getItem('rh-theme-data')
    if (raw) { try { return JSON.parse(raw) } catch {/**/ } }
    return THEMES[tn] ?? THEMES.classico
  })
  useEffect(() => { localStorage.setItem('rh-theme', themeName); localStorage.setItem('rh-theme-data', JSON.stringify(theme)) }, [theme, themeName])

  // ── Register
  const [regStep, setRegStep] = useState<RegStep>(1)
  const [showPass, setShowPass] = useState(false)
  const [showRegPass, setShowRegPass] = useState(false)
  const [showRegPass2, setShowRegPass2] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [forgotEmail, setForgotEmail] = useState('')
  const [regCountry, setRegCountry] = useState('PT')
  const [regPostal, setRegPostal] = useState('')
  const [regStreet, setRegStreet] = useState('')
  const [regNumber, setRegNumber] = useState('')
  const [regComplement, setRegComplement] = useState('')
  const [regCity, setRegCity] = useState('')
  const [regRegion, setRegRegion] = useState('')
  const [regStateAddr, setRegStateAddr] = useState('')
  const [lookupState, setLookupState] = useState<LookupState>('idle')
  const [regCompany, setRegCompany] = useState('')
  const [regTaxId, setRegTaxId] = useState('')
  const [regTelNum, setRegTelNum] = useState('')
  const [regNome, setRegNome] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPass, setRegPass] = useState('')
  const [regPass2, setRegPass2] = useState('')
  const [chkTerms, setChkTerms] = useState(false)
  const [chkData, setChkData] = useState(false)
  const [chkComm, setChkComm] = useState(false)
  const [successTitle, setSuccessTitle] = useState('')
  const [successSub, setSuccessSub] = useState('')
  const [modal, setModal] = useState<'terms'|'privacy'|null>(null)
  const [countryList, setCountryList] = useState<CountryItem[]>(FALLBACK_COUNTRIES)

  // ── Dashboard tabs
  const [dashTab, setDashTab] = useState<'colaboradores'|'empresa'>('colaboradores')
  const [showAppearancePanel, setShowAppearancePanel] = useState(false)

  // ── Empresa editing
  const [eNome, setENome] = useState('')
  const [eNif,  setENif]  = useState('')
  const [eTel,  setETel]  = useState('')
  const [eRua,  setERua]  = useState('')
  const [eNumero, setENumero] = useState('')
  const [eAndar,  setEAndar]  = useState('')
  const [eCP,     setECP]     = useState('')
  const [eLocalidade, setELocalidade] = useState('')
  const [eDistrito,   setEDistrito]   = useState('')
  const [empresaMsg, setEmpresaMsg] = useState<string|null>(null)

  // ── Responsive
  const [winW, setWinW] = useState(() => window.innerWidth)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  useEffect(() => {
    const onResize = () => { setWinW(window.innerWidth); if (window.innerWidth >= 768) setSidebarOpen(false) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── Colaboradores
  const [colabSubTab, setColabSubTab] = useState<'ativos'|'inativos'>('ativos')
  const [colabView, setColabView] = useState<'list'|'form'|'detail'>('list')
  const [colabPage, setColabPage] = useState(1)
  const [colabSearch, setColabSearch] = useState('')
  const [expandedColabId, setExpandedColabId] = useState<string|null>(null)
  const [selectedColab, setSelectedColab] = useState<Colaborador|null>(null)
  const [colabDetailTab, setColabDetailTab] = useState<'dados'|'documentos'>('dados')
  const [editingColab, setEditingColab] = useState<Colaborador|null>(null)
  const [allColaboradores, setAllColaboradores] = useState(initialAllColaboradores)

  // ── Deactivate modal
  const [deactivateTarget, setDeactivateTarget] = useState<string|null>(null)
  const [deactivateDate, setDeactivateDate] = useState('')
  const [deactivateMotivo, setDeactivateMotivo] = useState(MOTIVO_SAIDA[0])
  const [deactivateErr, setDeactivateErr] = useState('')

  // ── Permanent delete modal
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<string|null>(null)

  // ── Colab form fields
  const [fNome,setFNome]=useState(''); const [fNif,setFNif]=useState(''); const [fCargo,setFCargo]=useState('')
  const [fDept,setFDept]=useState(''); const [fEmail,setFEmail]=useState(''); const [fTel,setFTel]=useState('')
  const [fDataAdm,setFDataAdm]=useState(''); const [fContrato,setFContrato]=useState<Colaborador['tipoContrato']>('sem-termo')
  const [fRua,setFRua]=useState(''); const [fNumero,setFNumero]=useState(''); const [fAndar,setFAndar]=useState('')
  const [fCP,setFCP]=useState(''); const [fLocalidade,setFLocalidade]=useState(''); const [fDistrito,setFDistrito]=useState('')
  const [formColabErr,setFormColabErr]=useState('')

  // ── Document upload
  const [uploadNome, setUploadNome] = useState('')
  const [uploadFile, setUploadFile] = useState<File|null>(null)
  const [uploadErr, setUploadErr] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const cfg = getConfig(regCountry)
  const cfgPhone = countryList.find(c => c.code === regCountry)?.phone ?? ''
  const companiesRef = useRef(companies); companiesRef.current = companies

  // ── Effects
  useEffect(() => {
    fetch('https://restcountries.com/v3.1/all?fields=name,cca2,flag,idd,translations')
      .then(r=>r.json()).then((data:any[]) => {
        const list: CountryItem[] = data.filter((c:any)=>c.idd?.root&&c.idd?.suffixes?.length>0).map((c:any)=>({
          code:c.cca2, name:c.translations?.por?.common||c.name.common, flag:c.flag,
          phone:c.idd.suffixes.length===1?c.idd.root+c.idd.suffixes[0]:c.idd.root,
        })).sort((a:CountryItem,b:CountryItem)=>a.name.localeCompare(b.name,'pt'))
        setCountryList(list)
      }).catch(()=>{})
  },[])
  useEffect(() => {
    const sc = document.createElement('script'); sc.src='https://accounts.google.com/gsi/client'; sc.async=true
    document.head.appendChild(sc)
    sc.onload = () => window.google?.accounts.id.initialize({ client_id:'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com', callback:(r:any)=>handleGoogleCredentialRef.current(r) })
    return () => { if (document.head.contains(sc)) document.head.removeChild(sc) }
  },[])
  const handleGoogleCredentialRef = useRef((response:any) => {
    try {
      const payload = JSON.parse(atob(response.credential.split('.')[1]))
      const found = companiesRef.current.find(c=>c.email===payload.email)
      if (found) { setSelectedCompany(found); setSuccessTitle('Bem-vindo, '+payload.name.split(' ')[0]+'!'); setSuccessSub('Acesso via Google'); setScreen('success') }
      else { setRegEmail(payload.email); setRegNome(payload.name); setAlertState({type:'info',msg:'E-mail Google não registado. Complete o cadastro.'}); setScreen('register') }
    } catch {/**/ }
  })

  // ── Navigation helpers
  function goTo(sc: Screen) { setScreen(sc); setAlertState(null) }
  function triggerGoogle() { window.google?.accounts.id.prompt() }
  function resetAddressFields() { setRegPostal(''); setRegStreet(''); setRegNumber(''); setRegComplement(''); setRegCity(''); setRegRegion(''); setRegStateAddr(''); setLookupState('idle') }
  function handlePostalChange(val: string) { const m = cfg.postalMask?cfg.postalMask(val):val; setRegPostal(m); setLookupState('idle'); setRegCity(''); setRegRegion(''); setRegStateAddr('') }
  async function doPostalLookup() {
    if (!regPostal||!cfg.postalLookup) return; setLookupState('loading')
    const r = await lookupPostal(regPostal,regCountry)
    if (r) { if(r.city) setRegCity(r.city); if(r.region) setRegRegion(r.region); if(r.state) setRegStateAddr(r.state); if(r.street) setRegStreet(r.street); setLookupState('ok') }
    else setLookupState('err')
  }
  function doLogin() {
    if (!loginEmail||!loginPass) { setAlertState({type:'err',msg:'Preencha o e-mail e a senha.'}); return }
    const f = companies.find(c=>c.email===loginEmail&&c.pass===loginPass)
    if (f) { setSelectedCompany(f); setSuccessTitle('Bem-vindo, '+f.admin.split(' ')[0]+'!'); setSuccessSub('Acesso efetuado com sucesso'); goTo('success') }
    else setAlertState({type:'err',msg:'E-mail ou senha incorretos.'})
  }
  function doForgot() {
    if (!forgotEmail) { setAlertState({type:'err',msg:'Introduza o e-mail.'}); return }
    if (companies.find(c=>c.email===forgotEmail)) setAlertState({type:'ok',msg:'Link enviado! Verifique a sua caixa de entrada.'})
    else setAlertState({type:'err',msg:'E-mail não encontrado.'})
  }
  function regNext1() {
    setAlertState(null)
    if (!regCompany||!regTaxId||!regTelNum||!regPostal||!regStreet||!regCity||!regStateAddr) { setAlertState({type:'err',msg:'Preencha todos os campos obrigatórios (*).'}); return }
    setRegStep(2)
  }
  function regNext2() {
    setAlertState(null)
    if (!regNome||!regEmail) { setAlertState({type:'err',msg:'Preencha todos os campos obrigatórios (*).'}); return }
    if (!validarEmail(regEmail)) { setAlertState({type:'err',msg:'E-mail inválido.'}); return }
    if (companies.find(c=>c.email===regEmail)) { setAlertState({type:'err',msg:'Este e-mail já está registado.'}); return }
    setRegStep(3)
  }
  function doRegister() {
    setAlertState(null)
    if (regPass.length<8) { setAlertState({type:'err',msg:'A senha deve ter pelo menos 8 caracteres.'}); return }
    if (!/[A-Z]/.test(regPass)||!/[0-9]/.test(regPass)) { setAlertState({type:'err',msg:'A senha deve ter maiúsculas e pelo menos um número.'}); return }
    if (regPass!==regPass2) { setAlertState({type:'err',msg:'As senhas não coincidem.'}); return }
    if (!chkTerms||!chkData) { setAlertState({type:'err',msg:'Aceite os Termos e o consentimento de dados.'}); return }
    const nova: Company = { name:regCompany, taxId:regTaxId, email:regEmail, pass:regPass, admin:regNome, tel:cfgPhone+' '+regTelNum, country:regCountry, address:{street:regStreet,number:regNumber,complement:regComplement,postalCode:regPostal,city:regCity,region:regRegion,state:regStateAddr}, dataConsent:true, consentDate:new Date().toISOString().split('T')[0] }
    setCompanies(prev=>[...prev,nova]); setSelectedCompany(nova); setSuccessTitle('Bem-vindo, '+regNome.split(' ')[0]+'!'); setSuccessSub('Empresa registada com sucesso'); goTo('success')
  }

  // ── Empresa helpers
  function initEmpresaForm(c: Company) {
    setENome(c.name); setENif(c.taxId); setETel(c.tel)
    setERua(c.address.street); setENumero(c.address.number); setEAndar(c.address.complement)
    setECP(c.address.postalCode); setELocalidade(c.address.city); setEDistrito(c.address.state)
    setEmpresaMsg(null)
  }
  function saveEmpresa() {
    if (!eNome.trim()) { setEmpresaMsg('err:Nome da empresa é obrigatório.'); return }
    const updated: Company = { ...selectedCompany, name: eNome.trim(), taxId: eNif, tel: eTel, address: { ...selectedCompany.address, street: eRua, number: eNumero, complement: eAndar, postalCode: eCP, city: eLocalidade, state: eDistrito } }
    setCompanies(prev => prev.map(c => c.email === selectedCompany.email ? updated : c))
    setSelectedCompany(updated)
    setEmpresaMsg('ok:Dados guardados com sucesso.')
    setTimeout(() => setEmpresaMsg(null), 3000)
  }

  // ── Colaboradores helpers
  const colaboradores = allColaboradores[selectedCompany.email] ?? []
  const ativos  = colaboradores.filter(c=>c.ativo)
  const inativos = colaboradores.filter(c=>!c.ativo)
  const ativosFiltered = ativos.filter(c => c.nome.toLowerCase().includes(colabSearch.toLowerCase()))
  const totalPages = Math.max(1, Math.ceil(ativosFiltered.length / ITEMS_PER_PAGE))
  const paginatedAtivos = ativosFiltered.slice((colabPage-1)*ITEMS_PER_PAGE, colabPage*ITEMS_PER_PAGE)

  function updateColaboradores(fn: (prev: Colaborador[]) => Colaborador[]) {
    setAllColaboradores(prev => ({ ...prev, [selectedCompany.email]: fn(prev[selectedCompany.email]??[]) }))
  }
  function resetFormColab() {
    setFNome(''); setFNif(''); setFCargo(''); setFDept(''); setFEmail(''); setFTel('')
    setFDataAdm(''); setFContrato('sem-termo'); setFRua(''); setFNumero(''); setFAndar('')
    setFCP(''); setFLocalidade(''); setFDistrito(''); setFormColabErr('')
  }
  function iniciarEdicao(c: Colaborador) {
    setEditingColab(c)
    setFNome(c.nome); setFNif(c.nif); setFCargo(c.cargo); setFDept(c.departamento)
    setFEmail(c.email); setFTel(c.telefone); setFDataAdm(c.dataAdmissao); setFContrato(c.tipoContrato)
    setFRua(c.morada.rua); setFNumero(c.morada.numero); setFAndar(c.morada.andar)
    setFCP(c.morada.codigoPostal); setFLocalidade(c.morada.localidade); setFDistrito(c.morada.distrito)
    setFormColabErr(''); setColabView('form')
  }
  function adicionarColaborador() {
    setFormColabErr('')
    if (!fNome||!fNif||!fCargo||!fDept||!fEmail||!fTel||!fDataAdm) { setFormColabErr('Preencha todos os campos obrigatórios (*).'); return }
    if (!validarEmail(fEmail)) { setFormColabErr('E-mail inválido.'); return }
    const novo: Colaborador = { id:Date.now().toString(), nome:fNome, nif:fNif, cargo:fCargo, departamento:fDept, email:fEmail, telefone:fTel, dataAdmissao:fDataAdm, tipoContrato:fContrato, ativo:true, morada:{rua:fRua,numero:fNumero,andar:fAndar,codigoPostal:fCP,localidade:fLocalidade,distrito:fDistrito}, documentos:[] }
    updateColaboradores(prev=>[...prev,novo]); resetFormColab(); setColabView('list')
  }
  function atualizarColaborador() {
    if (!editingColab) return
    setFormColabErr('')
    if (!fNome||!fNif||!fCargo||!fDept||!fEmail||!fTel||!fDataAdm) { setFormColabErr('Preencha todos os campos obrigatórios (*).'); return }
    if (!validarEmail(fEmail)) { setFormColabErr('E-mail inválido.'); return }
    const updated: Colaborador = { ...editingColab, nome:fNome, nif:fNif, cargo:fCargo, departamento:fDept, email:fEmail, telefone:fTel, dataAdmissao:fDataAdm, tipoContrato:fContrato, morada:{rua:fRua,numero:fNumero,andar:fAndar,codigoPostal:fCP,localidade:fLocalidade,distrito:fDistrito} }
    updateColaboradores(prev=>prev.map(c=>c.id===editingColab.id?updated:c))
    setSelectedColab(updated); setEditingColab(null); resetFormColab(); setColabView('detail')
  }
  function desativarColaborador() {
    setDeactivateErr('')
    if (!deactivateDate) { setDeactivateErr('Indique a data de saída.'); return }
    if (!deactivateTarget) return
    updateColaboradores(prev=>prev.map(c=>c.id===deactivateTarget?{...c,ativo:false,dataSaida:deactivateDate,motivoSaida:deactivateMotivo}:c))
    if (selectedColab?.id===deactivateTarget) { setSelectedColab(null); setColabView('list') }
    setDeactivateTarget(null); setDeactivateDate(''); setDeactivateMotivo(MOTIVO_SAIDA[0]); setDeactivateErr('')
    setColabSubTab('inativos')
  }
  function reativarColaborador(id: string) {
    updateColaboradores(prev=>prev.map(c=>c.id===id?{...c,ativo:true,dataSaida:undefined,motivoSaida:undefined}:c))
    setColabSubTab('ativos')
  }
  function excluirPermanente(id: string) {
    updateColaboradores(prev=>prev.filter(c=>c.id!==id)); setPermanentDeleteTarget(null)
  }
  function adicionarDocumento() {
    setUploadErr('')
    if (!uploadNome||!uploadFile) { setUploadErr('Introduza um nome e selecione um ficheiro.'); return }
    const err = validarFicheiroDoc(uploadFile); if (err) { setUploadErr(err); return }
    if (!selectedColab) return
    const doc: Documento = { id:Date.now().toString(), nome:uploadNome, fileName:uploadFile.name, dataUpload:new Date().toISOString().split('T')[0], fileObj:uploadFile }
    const updated: Colaborador = { ...selectedColab, documentos:[...selectedColab.documentos,doc] }
    setSelectedColab(updated); updateColaboradores(prev=>prev.map(c=>c.id===selectedColab.id?updated:c))
    setUploadNome(''); setUploadFile(null); if (fileInputRef.current) fileInputRef.current.value=''
  }
  function removerDocumento(docId: string) {
    if (!selectedColab) return
    const updated: Colaborador = { ...selectedColab, documentos:selectedColab.documentos.filter(d=>d.id!==docId) }
    setSelectedColab(updated); updateColaboradores(prev=>prev.map(c=>c.id===selectedColab.id?updated:c))
  }
  function abrirDocumento(doc: Documento) {
    if (!doc.fileObj) return
    const url = URL.createObjectURL(doc.fileObj); window.open(url,'_blank'); setTimeout(()=>URL.revokeObjectURL(url),10000)
  }

  // ── Themed style helpers (computed from theme)
  const T = {
    wrap:      { ...s.wrap, background:theme.bg } as React.CSSProperties,
    card:      { ...s.card, background:theme.card, borderColor:theme.border } as React.CSSProperties,
    input:     { width:'100%', padding:'0 10px', height:'38px', border:'1px solid '+theme.border, borderRadius:'8px', background:theme.input, color:theme.text, fontSize:'13px', outline:'none', boxSizing:'border-box' as const },
    inputOk:   { width:'100%', padding:'0 10px', height:'38px', border:'1px solid #22c55e', borderRadius:'8px', background:'#f0fdf4', color:theme.text, fontSize:'13px', outline:'none', boxSizing:'border-box' as const },
    inputErr:  { width:'100%', padding:'0 10px', height:'38px', border:'1px solid #ef4444', borderRadius:'8px', background:theme.input, color:theme.text, fontSize:'13px', outline:'none', boxSizing:'border-box' as const },
    inputFill: { width:'100%', padding:'0 10px', height:'38px', border:'1px solid '+theme.border, borderRadius:'8px', background:theme.bg, color:theme.textMuted, fontSize:'13px', outline:'none', boxSizing:'border-box' as const },
    select:    { width:'100%', padding:'0 8px', height:'38px', border:'1px solid '+theme.border, borderRadius:'8px', background:theme.input, color:theme.text, fontSize:'13px', outline:'none', boxSizing:'border-box' as const },
    label:     { display:'block', fontSize:'12px', fontWeight:600, color:theme.textMuted, marginBottom:'5px' } as React.CSSProperties,
    sectionLbl:{ fontSize:'13px', fontWeight:700, color:theme.text, textTransform:'uppercase' as const, letterSpacing:'.05em', marginBottom:'10px', marginTop:'6px' } as React.CSSProperties,
    hint:      { fontSize:'11px', color:theme.textMuted, marginTop:'3px' } as React.CSSProperties,
    hintOk:    { fontSize:'11px', color:'#16a34a', marginTop:'3px' } as React.CSSProperties,
    hintErr:   { fontSize:'11px', color:'#ef4444', marginTop:'3px' } as React.CSSProperties,
    btnMain:   { width:'100%', height:'40px', background:theme.btn, color:theme.btnText, border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:600, cursor:'pointer', marginTop:'4px' } as React.CSSProperties,
    btnOutline:{ width:'100%', height:'40px', background:'transparent', color:theme.text, border:'1px solid '+theme.border, borderRadius:'8px', fontSize:'13px', fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', marginTop:'6px' } as React.CSSProperties,
    btnLink:   { fontSize:'13px', color:theme.btn, cursor:'pointer', background:'none', border:'none', padding:0, textDecoration:'underline' } as React.CSSProperties,
    backBtn:   { display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'12px', color:theme.textMuted, cursor:'pointer', background:'none', border:'none', padding:'4px 0', marginBottom:'1.25rem', opacity:.7 } as React.CSSProperties,
    title:     { fontSize:'22px', fontWeight:700, color:theme.text, margin:0 } as React.CSSProperties,
    sub:       { fontSize:'13px', color:theme.textMuted, marginTop:'4px' } as React.CSSProperties,
    card2:     { background:theme.card, border:'1px solid '+theme.border, borderRadius:'12px' } as React.CSSProperties,
    rgpdBox:   { background:theme.bg, border:'1px solid '+theme.border, borderRadius:'8px', padding:'12px', marginBottom:'0.875rem' } as React.CSSProperties,
    compItem:  { display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', border:'1px solid '+theme.border, borderRadius:'8px', marginBottom:'6px', cursor:'pointer', background:theme.card } as React.CSSProperties,
    eyeBtn:    { ...s.eyeBtn, color:theme.textMuted } as React.CSSProperties,
    passWrap:  s.passWrap,
  }
  const dividerLine = { flex:1, height:'1px', background:theme.border }
  const dividerTxt  = { fontSize:'12px', color:theme.textMuted }

  const forca = forcaSenha(regPass)
  const forcaCores = ['','#ef4444','#f97316','#eab308','#22c55e','#16a34a']
  const forcaLabels = ['','Muito fraca','Fraca','Razoável','Forte','Muito forte']

  function countryFlag(code: string) { return countryList.find(c=>c.code===code)?.flag??'' }
  function countryName(code: string) { return countryList.find(c=>c.code===code)?.name??code }

  function AlertBox() {
    if (!alertState) return null
    return <div style={alertState.type==='err'?s.alertErr:alertState.type==='ok'?s.alertOk:s.alertInfo}>{alertState.msg}</div>
  }
  function StepIndicator() {
    return (
      <div style={s.steps}>
        {([{n:1,label:'Empresa'},{n:2,label:'Administrador'},{n:3,label:'Acesso'}] as const).map((st,i)=>(
          <div key={st.n} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:regStep===st.n?theme.btn:regStep>st.n?'#16a34a':theme.textMuted }}>
              <div style={{ width:'22px', height:'22px', borderRadius:'50%', border:`1px solid ${regStep===st.n?theme.btn:regStep>st.n?'#16a34a':theme.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:600, background:regStep===st.n?theme.bg:regStep>st.n?'#f0fdf4':'transparent' }}>
                {regStep>st.n?'✓':st.n}
              </div>
              <span>{st.label}</span>
            </div>
            {i<2&&<div style={{ width:'24px', height:'1px', background:theme.border, margin:'0 4px' }}/>}
          </div>
        ))}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════
  // LOGIN
  // ════════════════════════════════════════════════════════════
  if (screen==='login') return (
    <div style={T.wrap}>
      <div style={T.card}>
        <div style={s.logoArea}>
          <div style={{ ...s.logoIcon, background:theme.bg }}><span style={{ fontSize:'24px' }}>👥</span></div>
          <p style={T.title}>RH Gestão</p>
          <p style={T.sub}>Aceda à sua conta de administrador</p>
        </div>
        <AlertBox/>
        <div style={s.field}>
          <label style={T.label}>E-mail</label>
          <input style={T.input} type="email" placeholder="admin@empresa.pt" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)}/>
        </div>
        <div style={s.field}>
          <label style={T.label}>Senha</label>
          <div style={T.passWrap}>
            <input style={{...T.input,paddingRight:'36px'}} type={showPass?'text':'password'} placeholder="••••••••" value={loginPass} onChange={e=>setLoginPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doLogin()}/>
            <button style={T.eyeBtn} onClick={()=>setShowPass(!showPass)}>{showPass?'🙈':'👁'}</button>
          </div>
        </div>
        <button style={T.btnMain} onClick={doLogin}>Entrar</button>
        <button onClick={triggerGoogle} style={{ width:'100%', height:'40px', background:theme.card, color:theme.text, border:'1px solid '+theme.border, borderRadius:'8px', fontSize:'14px', fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', marginTop:'6px' }}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.706 17.64 9.2z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/></svg>
          Entrar com Google
        </button>
        <div style={s.divider}><div style={dividerLine}/><span style={dividerTxt}>ou</span><div style={dividerLine}/></div>
        <button onClick={()=>goTo('register')} style={{ width:'100%', height:'40px', background:theme.bg, color:theme.btn, border:'1px solid '+theme.border, borderRadius:'8px', fontSize:'14px', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', marginTop:'6px' }}>
          🏢 Cadastrar nova empresa
        </button>
        <p style={{ ...s.msgCenter, color:theme.textMuted }}>
          <button style={T.btnLink} onClick={()=>goTo('forgot')}>Esqueci a senha</button>
          {'  ·  '}
          <button style={T.btnLink} onClick={()=>goTo('companies')}>Trocar empresa</button>
        </p>
      </div>
    </div>
  )

  // ════════════════════════════════════════════════════════════
  // FORGOT
  // ════════════════════════════════════════════════════════════
  if (screen==='forgot') return (
    <div style={T.wrap}>
      <div style={T.card}>
        <button style={T.backBtn} onClick={()=>goTo('login')}>← Voltar</button>
        <div style={s.logoArea}>
          <div style={{ ...s.logoIcon, background:theme.bg }}>✉️</div>
          <p style={T.title}>Recuperar acesso</p>
          <p style={T.sub}>Enviaremos um link de redefinição para o seu e-mail</p>
        </div>
        <AlertBox/>
        <div style={s.field}><label style={T.label}>E-mail cadastrado</label><input style={T.input} type="email" placeholder="admin@empresa.pt" value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)}/></div>
        <button style={T.btnMain} onClick={doForgot}>Enviar link de recuperação</button>
      </div>
    </div>
  )

  // ════════════════════════════════════════════════════════════
  // REGISTER
  // ════════════════════════════════════════════════════════════
  if (screen==='register') return (
    <div style={T.wrap}>
      <div style={T.card}>
        <button style={T.backBtn} onClick={()=>goTo('login')}>← Voltar ao login</button>
        <div style={s.logoArea}>
          <div style={{ ...s.logoIcon, background:theme.bg }}>🏢</div>
          <p style={T.title}>Cadastrar empresa</p>
        </div>
        <StepIndicator/>
        <AlertBox/>

        {regStep===1&&(<>
          <p style={T.sectionLbl}>País e morada</p>
          <div style={s.field}><label style={T.label}>País *</label><CountryPicker value={regCountry} onChange={code=>{setRegCountry(code);resetAddressFields()}} list={countryList} inputStyle={{ background:theme.input, color:theme.text, borderColor:theme.border }}/></div>
          <div style={s.field}>
            <label style={T.label}>{cfg.postalLabel} *</label>
            <div style={{ display:'flex', gap:'6px' }}>
              <input style={{ ...(lookupState==='ok'?T.inputOk:lookupState==='err'?T.inputErr:T.input), flex:1 }} type="text" placeholder={cfg.postalPlaceholder} value={regPostal} onChange={e=>handlePostalChange(e.target.value)} onBlur={()=>{if(cfg.postalLookup)doPostalLookup()}}/>
              {cfg.postalLookup&&<button style={{ height:'38px', padding:'0 12px', background:theme.bg, border:'1px solid '+theme.border, borderRadius:'8px', color:theme.btn, fontSize:'12px', cursor:'pointer', whiteSpace:'nowrap' }} onClick={doPostalLookup}>{lookupState==='loading'?'...':'🔍'}</button>}
            </div>
            {lookupState==='ok'&&<p style={T.hintOk}>✓ Morada preenchida automaticamente</p>}
            {lookupState==='err'&&<p style={T.hintErr}>Código postal não encontrado. Preencha manualmente.</p>}
            {lookupState==='idle'&&cfg.postalLookup&&<p style={T.hint}>Preencha para preenchimento automático</p>}
          </div>
          <div style={s.field}><label style={T.label}>{cfg.streetLabel} *</label><input style={lookupState==='ok'&&regStreet?T.inputFill:T.input} type="text" placeholder="Ex: Rua Augusta" value={regStreet} onChange={e=>setRegStreet(e.target.value)}/></div>
          <div style={cfg.hasComplement?s.row3:{marginBottom:'0.875rem'}}>
            <div><label style={T.label}>Número</label><input style={T.input} type="text" placeholder="42" value={regNumber} onChange={e=>setRegNumber(e.target.value)}/></div>
            {cfg.hasComplement&&<div><label style={T.label}>{cfg.complementLabel}</label><input style={T.input} type="text" placeholder="2º Dto" value={regComplement} onChange={e=>setRegComplement(e.target.value)}/></div>}
          </div>
          <div style={s.row2}>
            <div><label style={T.label}>{cfg.cityLabel} *</label><input style={lookupState==='ok'&&regCity?T.inputFill:T.input} type="text" placeholder={cfg.cityLabel} value={regCity} onChange={e=>setRegCity(e.target.value)}/></div>
            <div><label style={T.label}>{cfg.stateLabel} *</label><input style={lookupState==='ok'&&regStateAddr?T.inputFill:T.input} type="text" placeholder={cfg.stateLabel} value={regStateAddr} onChange={e=>setRegStateAddr(e.target.value)}/></div>
          </div>
          {cfg.regionLabel!==''&&<div style={s.field}><label style={T.label}>{cfg.regionLabel}</label><input style={T.input} type="text" placeholder={cfg.regionLabel} value={regRegion} onChange={e=>setRegRegion(e.target.value)}/></div>}
          <p style={{ ...T.sectionLbl, marginTop:'12px' }}>Dados da empresa</p>
          <div style={s.field}><label style={T.label}>Nome da empresa *</label><input style={T.input} type="text" placeholder="Ex: Clínica Saúde Lisboa, Lda." value={regCompany} onChange={e=>setRegCompany(e.target.value)}/></div>
          <div style={s.row2}>
            <div><label style={T.label}>{cfg.taxLabel} *</label><input style={T.input} type="text" placeholder={cfg.taxLabel} value={regTaxId} onChange={e=>setRegTaxId(e.target.value)}/></div>
            <div>
              <label style={T.label}>Telefone *</label>
              <div style={{ display:'flex', gap:'4px' }}>
                <span style={{ height:'38px', padding:'0 8px', border:'1px solid '+theme.border, borderRadius:'8px', background:theme.bg, color:theme.textMuted, fontSize:'12px', display:'flex', alignItems:'center', whiteSpace:'nowrap', flexShrink:0 }}>{cfgPhone}</span>
                <input style={{ ...T.input, flex:1 }} type="tel" placeholder="21 000 0000" value={regTelNum} onChange={e=>setRegTelNum(e.target.value)}/>
              </div>
            </div>
          </div>
          <button style={T.btnMain} onClick={regNext1}>Continuar →</button>
        </>)}

        {regStep===2&&(<>
          <p style={T.sectionLbl}>Dados do administrador</p>
          <div style={s.field}><label style={T.label}>Nome completo *</label><input style={T.input} type="text" placeholder="Ex: Maria Silva" value={regNome} onChange={e=>setRegNome(e.target.value)}/></div>
          <div style={s.field}><label style={T.label}>E-mail *</label><input style={T.input} type="email" placeholder="admin@empresa.pt" value={regEmail} onChange={e=>setRegEmail(e.target.value)}/><p style={T.hint}>Usado para recuperação de acesso</p></div>
          <button style={T.btnMain} onClick={regNext2}>Continuar →</button>
          <button style={T.btnOutline} onClick={()=>{setAlertState(null);setRegStep(1)}}>← Voltar</button>
        </>)}

        {modal&&(
          <div onClick={()=>setModal(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
            <div onClick={e=>e.stopPropagation()} style={{ background:theme.card, borderRadius:'16px', width:'100%', maxWidth:'500px', maxHeight:'80vh', display:'flex', flexDirection:'column', border:'1px solid '+theme.border }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.25rem 1.5rem', borderBottom:'1px solid '+theme.border, flexShrink:0 }}>
                <p style={{ fontWeight:700, fontSize:'16px', color:theme.text, margin:0 }}>{modal==='terms'?'📋 Termos de Uso':'🔒 Política de Privacidade'}</p>
                <button onClick={()=>setModal(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'18px', color:theme.textMuted, lineHeight:1 }}>✕</button>
              </div>
              <div style={{ overflowY:'auto', padding:'1.25rem 1.5rem', fontSize:'13px', color:theme.text, lineHeight:'1.7' }}>
                {modal==='terms'?(<>
                  <p><strong>1. Aceitação dos Termos</strong></p><p>Ao criar uma conta na plataforma RH Gestão, o utilizador declara ter lido, compreendido e aceite os presentes Termos de Uso.</p>
                  <p><strong>2. Descrição do Serviço</strong></p><p>O RH Gestão é uma plataforma de gestão de recursos humanos destinada a empresas.</p>
                  <p><strong>3. Responsabilidades do Utilizador</strong></p><p>O utilizador é responsável por manter as suas credenciais de acesso em segurança e por garantir que os dados inseridos são verdadeiros.</p>
                  <p><strong>4. Propriedade Intelectual</strong></p><p>Todo o conteúdo, código e design da plataforma são propriedade exclusiva da RH Gestão.</p>
                  <p><strong>5. Suspensão e Encerramento</strong></p><p>A RH Gestão reserva-se o direito de suspender ou encerrar contas que violem os presentes Termos.</p>
                  <p><strong>6. Alterações aos Termos</strong></p><p>Reservamo-nos o direito de atualizar estes Termos a qualquer momento.</p>
                  <p><strong>7. Lei Aplicável</strong></p><p>Os presentes Termos são regidos pela legislação portuguesa.</p>
                </>):(<>
                  <p><strong>1. Responsável pelo Tratamento</strong></p><p>A RH Gestão compromete-se a proteger os seus dados nos termos do RGPD (Regulamento UE 2016/679).</p>
                  <p><strong>2. Dados Recolhidos</strong></p><p>Recolhemos: nome, e-mail, NIF, dados de contacto, morada e dados da empresa.</p>
                  <p><strong>3. Finalidade</strong></p><p>Dados utilizados para prestação dos serviços, gestão de conta e cumprimento de obrigações legais.</p>
                  <p><strong>4. Base Legal</strong></p><p>Consentimento expresso do titular (art. 6.º, n.º 1, al. a) do RGPD).</p>
                  <p><strong>5. Conservação</strong></p><p>Dados conservados pelo período necessário, eliminados após encerramento da conta.</p>
                  <p><strong>6. Direitos do Titular</strong></p><p>Direito a aceder, retificar e apagar os seus dados. Contacte: <strong>privacidade@rhgestao.pt</strong></p>
                  <p><strong>7. Segurança</strong></p><p>Adotamos medidas técnicas e organizativas adequadas para proteger os dados conforme o RGPD.</p>
                </>)}
              </div>
              <div style={{ padding:'1rem 1.5rem', borderTop:'1px solid '+theme.border, flexShrink:0 }}>
                <button onClick={()=>setModal(null)} style={{ width:'100%', height:'38px', background:theme.btn, color:theme.btnText, border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:600, cursor:'pointer' }}>Fechar</button>
              </div>
            </div>
          </div>
        )}

        {regStep===3&&(<>
          <p style={T.sectionLbl}>Credenciais de acesso</p>
          <div style={s.field}>
            <label style={T.label}>Criar senha *</label>
            <div style={T.passWrap}>
              <input style={{ ...T.input, paddingRight:'36px' }} type={showRegPass?'text':'password'} placeholder="Mínimo 8 caracteres" value={regPass} onChange={e=>setRegPass(e.target.value)}/>
              <button style={T.eyeBtn} onClick={()=>setShowRegPass(!showRegPass)}>{showRegPass?'🙈':'👁'}</button>
            </div>
            {regPass.length>0&&(<>
              <div style={{ height:'4px', borderRadius:'2px', background:theme.border, marginTop:'6px', overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:'2px', width:`${(forca/5)*100}%`, background:forcaCores[forca], transition:'width .3s' }}/>
              </div>
              <p style={{ ...T.hint, color:forcaCores[forca]||theme.textMuted, marginTop:'3px' }}>{forcaLabels[forca]}</p>
            </>)}
            {regPass.length===0&&<p style={T.hint}>Use maiúsculas, minúsculas, números e símbolos</p>}
          </div>
          <div style={s.field}>
            <label style={T.label}>Confirmar senha *</label>
            <div style={T.passWrap}>
              <input style={{ ...T.input, paddingRight:'36px' }} type={showRegPass2?'text':'password'} placeholder="Repita a senha" value={regPass2} onChange={e=>setRegPass2(e.target.value)}/>
              <button style={T.eyeBtn} onClick={()=>setShowRegPass2(!showRegPass2)}>{showRegPass2?'🙈':'👁'}</button>
            </div>
          </div>
          <div style={T.rgpdBox}>
            <p style={{ fontSize:'13px', fontWeight:700, color:theme.text, marginBottom:'8px' }}>{cfg.isEU?'🛡 Proteção de dados — RGPD':'🛡 Proteção de dados'}</p>
            <div style={s.checkRow}>
              <input type="checkbox" id="chk-terms" checked={chkTerms} onChange={e=>setChkTerms(e.target.checked)} style={{ marginTop:'2px', flexShrink:0 }}/>
              <label htmlFor="chk-terms" style={{ fontSize:'12px', color:theme.textMuted, lineHeight:'1.5', cursor:'pointer' }}>
                Li e aceito os{' '}<button type="button" onClick={e=>{e.preventDefault();setModal('terms')}} style={{ color:theme.btn, background:'none', border:'none', padding:0, cursor:'pointer', fontSize:'12px', textDecoration:'underline' }}>Termos de Uso</button>{' '}e a{' '}<button type="button" onClick={e=>{e.preventDefault();setModal('privacy')}} style={{ color:theme.btn, background:'none', border:'none', padding:0, cursor:'pointer', fontSize:'12px', textDecoration:'underline' }}>Política de Privacidade</button> *
              </label>
            </div>
            <div style={s.checkRow}>
              <input type="checkbox" id="chk-data" checked={chkData} onChange={e=>setChkData(e.target.checked)} style={{ marginTop:'2px', flexShrink:0 }}/>
              <label htmlFor="chk-data" style={{ fontSize:'12px', color:theme.textMuted, lineHeight:'1.5', cursor:'pointer' }}>{cfg.isEU?'Consinto o tratamento dos dados nos termos do RGPD *':'Consinto o tratamento dos dados para gestão de RH *'}</label>
            </div>
            <div style={{ ...s.checkRow, marginBottom:0 }}>
              <input type="checkbox" id="chk-comm" checked={chkComm} onChange={e=>setChkComm(e.target.checked)} style={{ marginTop:'2px', flexShrink:0 }}/>
              <label htmlFor="chk-comm" style={{ fontSize:'12px', color:theme.textMuted, lineHeight:'1.5', cursor:'pointer' }}>Aceito receber comunicações sobre o serviço (opcional)</label>
            </div>
          </div>
          <button style={T.btnMain} onClick={doRegister}>Criar conta</button>
          <button style={T.btnOutline} onClick={()=>{setAlertState(null);setRegStep(2)}}>← Voltar</button>
        </>)}
      </div>
    </div>
  )

  // ════════════════════════════════════════════════════════════
  // COMPANIES
  // ════════════════════════════════════════════════════════════
  if (screen==='companies') return (
    <div style={T.wrap}>
      <div style={T.card}>
        <button style={T.backBtn} onClick={()=>goTo('login')}>← Voltar</button>
        <div style={s.logoArea}><div style={{ ...s.logoIcon, background:theme.bg }}>🏘️</div><p style={T.title}>Minhas empresas</p><p style={T.sub}>Selecione a empresa para aceder</p></div>
        {companies.map((c,i)=>(
          <div key={i} style={{ ...T.compItem, ...(c===selectedCompany?{borderColor:theme.btn,background:theme.bg}:{}) }} onClick={()=>{setSelectedCompany(c);setLoginEmail(c.email);goTo('login')}}>
            <div style={{ width:'32px', height:'32px', borderRadius:'8px', background:theme.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:700, color:theme.btn, flexShrink:0 }}>{c.name.charAt(0)}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:'13px', fontWeight:600, color:theme.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', margin:0 }}>{c.name}</p>
              <p style={{ fontSize:'11px', color:theme.textMuted, margin:0 }}>{countryFlag(c.country)} {c.email}</p>
            </div>
            {c===selectedCompany&&<span style={{ color:theme.btn, fontSize:'16px' }}>✓</span>}
          </div>
        ))}
        <button style={T.btnOutline} onClick={()=>goTo('register')}>+ Adicionar nova empresa</button>
      </div>
    </div>
  )

  // ════════════════════════════════════════════════════════════
  // SUCCESS
  // ════════════════════════════════════════════════════════════
  if (screen==='success') return (
    <div style={T.wrap}>
      <div style={T.card}>
        <div style={s.logoArea}>
          <div style={{ ...s.logoIcon, background:'#f0fdf4' }}>✅</div>
          <p style={T.title}>{successTitle}</p>
          <p style={T.sub}>{successSub}</p>
        </div>
        <div style={{ background:theme.bg, borderRadius:'8px', padding:'1rem', textAlign:'center', marginBottom:'1.25rem', border:'1px solid '+theme.border }}>
          <p style={{ fontSize:'12px', color:theme.textMuted, margin:0 }}>Empresa ativa</p>
          <p style={{ fontSize:'16px', fontWeight:700, color:theme.text, marginTop:'4px', marginBottom:'2px' }}>{selectedCompany.name}</p>
          <p style={{ fontSize:'12px', color:theme.textMuted, margin:0 }}>{countryFlag(selectedCompany.country)} {countryName(selectedCompany.country)}</p>
        </div>
        <button style={T.btnMain} onClick={()=>{setColabView('list');setSelectedColab(null);setEditingColab(null);goTo('dashboard')}}>Ir para o dashboard →</button>
      </div>
    </div>
  )

  // ════════════════════════════════════════════════════════════
  // DASHBOARD
  // ════════════════════════════════════════════════════════════
  if (screen==='dashboard') {
    const btnSm = (bg: string, fg: string): React.CSSProperties => ({ height:'30px', padding:'0 10px', background:bg, border:'none', borderRadius:'6px', color:fg, fontSize:'12px', fontWeight:500, cursor:'pointer' })
    const btnMd = (bg: string, fg: string): React.CSSProperties => ({ height:'36px', padding:'0 14px', background:bg, border:'none', borderRadius:'8px', color:fg, fontSize:'13px', fontWeight:600, cursor:'pointer' })

    const isMobile  = winW < 768
    const isTablet  = winW >= 768 && winW < 1024
    const SIDEBAR_W = isTablet ? 64 : 220
    const TOPBAR_H  = 56

    const navItem = (icon: string, label: string, tab: 'colaboradores'|'empresa', disabled = false) => {
      const active    = dashTab === tab && !disabled
      const collapsed = isTablet
      return (
        <button key={label} disabled={disabled} title={collapsed ? label : undefined}
          onClick={()=>{ if(!disabled){ setDashTab(tab); if(tab==='empresa') initEmpresaForm(selectedCompany); if(isMobile) setSidebarOpen(false) } }}
          style={{ display:'flex', alignItems:'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? 0 : '10px', width:'100%', padding: collapsed ? '12px 0' : '10px 14px', background: active ? 'rgba(255,255,255,.15)' : 'none', border:'none', borderLeft: active && !collapsed ? '3px solid #fff' : collapsed ? 'none' : '3px solid transparent', borderRight:'none', borderTop:'none', borderBottom:'none', borderRadius:0, color: disabled ? 'rgba(255,255,255,.3)' : active ? '#fff' : 'rgba(255,255,255,.7)', fontSize:'13px', fontWeight: active ? 700 : 400, cursor: disabled ? 'default' : 'pointer', textAlign: collapsed ? 'center' as const : 'left' as const }}>
          <span style={{ fontSize: collapsed ? '19px' : '16px', width: collapsed ? 'auto' : '20px', textAlign:'center' as const, flexShrink:0 }}>{icon}</span>
          {!collapsed && <span style={{ flex:1 }}>{label}</span>}
          {!collapsed && disabled && <span style={{ fontSize:'9px', background:'rgba(255,255,255,.15)', color:'rgba(255,255,255,.5)', borderRadius:'4px', padding:'1px 5px', fontWeight:400 }}>em breve</span>}
        </button>
      )
    }

    return (
      <div style={{ background:theme.bg, minHeight:'100vh', fontFamily:'system-ui, sans-serif', display:'flex' }}>

        {/* ══ MOBILE TOP BAR ══ */}
        {isMobile&&(
          <div style={{ position:'fixed', top:0, left:0, right:0, height:TOPBAR_H, background:theme.nav, display:'flex', alignItems:'center', gap:'12px', padding:'0 16px', zIndex:120 }}>
            <button onClick={()=>setSidebarOpen(o=>!o)} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', flexDirection:'column', gap:'5px', padding:'4px', flexShrink:0 }}>
              <span style={{ display:'block', width:'22px', height:'2px', background:'#fff', borderRadius:'2px', transition:'transform .2s', transform: sidebarOpen ? 'translateY(7px) rotate(45deg)' : 'none' }}/>
              <span style={{ display:'block', width:'22px', height:'2px', background:'#fff', borderRadius:'2px', opacity: sidebarOpen ? 0 : 1, transition:'opacity .15s' }}/>
              <span style={{ display:'block', width:'22px', height:'2px', background:'#fff', borderRadius:'2px', transition:'transform .2s', transform: sidebarOpen ? 'translateY(-7px) rotate(-45deg)' : 'none' }}/>
            </button>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <div style={{ width:'28px', height:'28px', borderRadius:'7px', background:'rgba(255,255,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px' }}>👥</div>
              <span style={{ fontWeight:800, fontSize:'14px', color:'#fff' }}>RH Gestão</span>
            </div>
            <span style={{ fontSize:'12px', color:'rgba(255,255,255,.5)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selectedCompany.name}</span>
          </div>
        )}

        {/* ══ MOBILE OVERLAY ══ */}
        {isMobile&&sidebarOpen&&(
          <div onClick={()=>setSidebarOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:110 }}/>
        )}

        {/* ══ SIDEBAR ══ */}
        <div style={{ width:SIDEBAR_W, minWidth:SIDEBAR_W, background:theme.nav, display:'flex', flexDirection:'column', position:'fixed', left: isMobile && !sidebarOpen ? -SIDEBAR_W : 0, top:0, bottom:0, zIndex:115, overflowY:'auto', transition: isMobile ? 'left .25s ease' : 'width .2s ease' }}>
          {/* Logo */}
          {!isTablet&&(
            <div style={{ padding:'20px 16px 22px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
                <div style={{ width:'34px', height:'34px', borderRadius:'9px', background:'rgba(255,255,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'17px', flexShrink:0 }}>👥</div>
                <span style={{ fontWeight:800, fontSize:'15px', color:'#fff', letterSpacing:'-.01em' }}>RH Gestão</span>
              </div>
              <p style={{ fontSize:'11px', color:'rgba(255,255,255,.5)', margin:'0 0 2px 0', paddingLeft:'44px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selectedCompany.name}</p>
              <p style={{ fontSize:'11px', color:'rgba(255,255,255,.35)', margin:0, paddingLeft:'44px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>👤 {selectedCompany.admin}</p>
            </div>
          )}
          {isTablet&&(
            <div style={{ padding:'18px 0 14px', display:'flex', justifyContent:'center' }}>
              <div style={{ width:'36px', height:'36px', borderRadius:'9px', background:'rgba(255,255,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px' }}>👥</div>
            </div>
          )}

          {/* Nav */}
          <nav style={{ flex:1, display:'flex', flexDirection:'column', gap:'2px', padding:'0 0 8px' }}>
            {navItem('👥', 'Colaboradores', 'colaboradores')}
            {navItem('🕐', 'Horários', 'colaboradores', true)}
            {navItem('🌴', 'Férias', 'colaboradores', true)}
            {navItem('⏱️', 'Banco de Horas', 'colaboradores', true)}
            <div style={{ height:'1px', background:'rgba(255,255,255,.1)', margin:'8px 14px' }}/>
            {navItem('🏢', 'Dados da Empresa', 'empresa')}
            <button title={isTablet ? 'Aparência' : undefined} onClick={()=>{setShowAppearancePanel(p=>!p); if(isMobile) setSidebarOpen(false)}}
              style={{ display:'flex', alignItems:'center', justifyContent: isTablet ? 'center' : 'flex-start', gap: isTablet ? 0 : '10px', width:'100%', padding: isTablet ? '12px 0' : '10px 14px', background: showAppearancePanel ? 'rgba(255,255,255,.15)' : 'none', border:'none', borderLeft: showAppearancePanel && !isTablet ? '3px solid #fff' : isTablet ? 'none' : '3px solid transparent', borderRight:'none', borderTop:'none', borderBottom:'none', borderRadius:0, color: showAppearancePanel ? '#fff' : 'rgba(255,255,255,.7)', fontSize:'13px', fontWeight: showAppearancePanel ? 700 : 400, cursor:'pointer', textAlign: isTablet ? 'center' as const : 'left' as const }}>
              <span style={{ fontSize: isTablet ? '19px' : '16px', width: isTablet ? 'auto' : '20px', textAlign:'center' as const }}>🎨</span>
              {!isTablet&&<span>Aparência</span>}
            </button>
          </nav>

          {/* Sair */}
          <div style={{ padding: isTablet ? '12px 8px 16px' : '12px 8px 16px' }}>
            <button onClick={()=>{setColabView('list');setSelectedColab(null);setEditingColab(null);goTo('login')}}
              title={isTablet ? 'Sair' : undefined}
              style={{ display:'flex', alignItems:'center', justifyContent: isTablet ? 'center' : 'flex-start', gap: isTablet ? 0 : '10px', width:'100%', padding: isTablet ? '12px 0' : '10px 14px', background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', borderRadius:'8px', color:'rgba(255,255,255,.7)', fontSize:'13px', cursor:'pointer' }}>
              <span style={{ fontSize: isTablet ? '19px' : '16px' }}>🚪</span>
              {!isTablet&&<span>Sair</span>}
            </button>
          </div>
        </div>

        {/* ══ APPEARANCE PANEL (floating) ══ */}
        {showAppearancePanel&&(
          <div style={{ position:'fixed', left: isMobile ? 12 : SIDEBAR_W+12, right: isMobile ? 12 : 'auto', top: isMobile ? TOPBAR_H+8 : 80, zIndex:200, background:theme.card, border:'1px solid '+theme.border, borderRadius:'14px', padding:'1.25rem', width: isMobile ? 'auto' : '300px', boxShadow:'0 8px 32px rgba(0,0,0,.18)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
              <p style={{ fontWeight:700, fontSize:'14px', color:theme.text, margin:0 }}>🎨 Aparência</p>
              <button onClick={()=>setShowAppearancePanel(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'16px', color:theme.textMuted, lineHeight:1 }}>✕</button>
            </div>
            {/* Theme circles */}
            <p style={{ fontSize:'11px', fontWeight:700, color:theme.textMuted, textTransform:'uppercase', letterSpacing:'.05em', margin:'0 0 8px 0' }}>Tema</p>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'1rem' }}>
              {Object.entries(THEMES).map(([key,t])=>(
                <button key={key} title={THEME_LABELS[key]} onClick={()=>{setThemeName(key);setTheme(t)}}
                  style={{ width:'36px', height:'36px', borderRadius:'50%', background:t.nav, border: themeName===key ? '3px solid '+theme.btn : '3px solid transparent', cursor:'pointer', outline: themeName===key ? '2px solid '+theme.btn : 'none', outlineOffset:'2px', position:'relative' as const, flexShrink:0 }}>
                  {themeName===key&&<span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', color:t.navText }}>✓</span>}
                </button>
              ))}
            </div>
            <div style={{ display:'flex', gap:'6px', marginBottom:'4px' }}>
              {Object.entries(THEMES).map(([key])=>(
                <span key={key} style={{ flex:1, fontSize:'9px', color:theme.textMuted, textAlign:'center' as const, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{THEME_LABELS[key]}</span>
              ))}
            </div>
            {/* Color pickers */}
            <p style={{ fontSize:'11px', fontWeight:700, color:theme.textMuted, textTransform:'uppercase', letterSpacing:'.05em', margin:'14px 0 8px 0' }}>Personalização</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
              {([['Fundo','bg'],['Texto','text'],['Botões','btn'],['Menu','nav']] as [string,keyof Theme][]).map(([lbl,key])=>(
                <div key={key} style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <input type="color" value={theme[key] as string} onChange={e=>{setTheme(prev=>({...prev,[key]:e.target.value}));setThemeName('custom')}}
                    style={{ width:'32px', height:'32px', borderRadius:'6px', border:'1px solid '+theme.border, cursor:'pointer', padding:'2px', background:'transparent', flexShrink:0 }}/>
                  <span style={{ fontSize:'11px', color:theme.textMuted }}>{lbl}</span>
                </div>
              ))}
            </div>
            <button onClick={()=>setShowAppearancePanel(false)} style={{ width:'100%', height:'36px', background:theme.btn, color:theme.btnText, border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:600, cursor:'pointer', marginTop:'1rem' }}>Fechar</button>
          </div>
        )}

        {/* ══ MAIN CONTENT ══ */}
        <div style={{ marginLeft: isMobile ? 0 : SIDEBAR_W, flex:1, padding: isMobile ? '1rem' : '1.5rem', paddingTop: isMobile ? TOPBAR_H+16 : '1.5rem', minHeight:'100vh', minWidth:0, display:'flex', flexDirection:'column' }}>
          <div style={{ maxWidth:'1100px', margin:'0 auto', width:'100%', flex:1, display:'flex', flexDirection:'column' }}>

            {/* ═══ COLABORADORES TAB ═══ */}
            {dashTab==='colaboradores'&&(<div style={{ flex:1, display:'flex', flexDirection:'column' }}>

              {/* Deactivate modal */}
              {deactivateTarget&&(
                <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
                  <div style={{ background:theme.card, borderRadius:'16px', padding:'1.5rem', width:'100%', maxWidth:'400px', border:'1px solid '+theme.border }}>
                    <p style={{ fontWeight:700, fontSize:'17px', color:theme.text, marginTop:0, marginBottom:'6px' }}>Desativar colaborador</p>
                    <p style={{ fontSize:'13px', color:theme.textMuted, marginBottom:'1.25rem' }}>O colaborador será movido para a lista de inativos. Os dados ficam guardados.</p>
                    {deactivateErr&&<div style={{ ...s.alertErr, marginBottom:'10px' }}>{deactivateErr}</div>}
                    <div style={{ marginBottom:'12px' }}>
                      <label style={T.label}>Data de saída *</label>
                      <input style={T.input} type="date" value={deactivateDate} onChange={e=>setDeactivateDate(e.target.value)}/>
                    </div>
                    <div style={{ marginBottom:'1.25rem' }}>
                      <label style={T.label}>Motivo</label>
                      <select style={T.select} value={deactivateMotivo} onChange={e=>setDeactivateMotivo(e.target.value)}>
                        {MOTIVO_SAIDA.map(m=><option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div style={{ display:'flex', gap:'8px' }}>
                      <button onClick={()=>{setDeactivateTarget(null);setDeactivateDate('');setDeactivateErr('')}} style={{ flex:1, height:'38px', background:theme.bg, border:'1px solid '+theme.border, borderRadius:'8px', color:theme.text, fontSize:'13px', cursor:'pointer' }}>Cancelar</button>
                      <button onClick={desativarColaborador} style={{ flex:1, height:'38px', background:'#f97316', border:'none', borderRadius:'8px', color:'#fff', fontSize:'13px', fontWeight:600, cursor:'pointer' }}>Desativar</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Permanent delete modal */}
              {permanentDeleteTarget&&(
                <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
                  <div style={{ background:theme.card, borderRadius:'16px', padding:'1.5rem', width:'100%', maxWidth:'420px', border:'1px solid '+theme.border }}>
                    <p style={{ fontWeight:700, fontSize:'17px', color:'#b91c1c', marginTop:0, marginBottom:'6px' }}>⚠️ Excluir permanentemente?</p>
                    <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 12px', marginBottom:'1.25rem' }}>
                      <p style={{ fontSize:'12px', color:'#b91c1c', margin:0, lineHeight:'1.6' }}>Os dados laborais devem ser conservados por um mínimo de 5 anos conforme a legislação portuguesa. Tem a certeza que pretende eliminar permanentemente?</p>
                    </div>
                    <div style={{ display:'flex', gap:'8px' }}>
                      <button onClick={()=>setPermanentDeleteTarget(null)} style={{ flex:1, height:'38px', background:theme.bg, border:'1px solid '+theme.border, borderRadius:'8px', color:theme.text, fontSize:'13px', cursor:'pointer' }}>Cancelar</button>
                      <button onClick={()=>excluirPermanente(permanentDeleteTarget!)} style={{ flex:1, height:'38px', background:'#ef4444', border:'none', borderRadius:'8px', color:'#fff', fontSize:'13px', fontWeight:600, cursor:'pointer' }}>Excluir permanentemente</button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── LIST VIEW ── */}
              {colabView==='list'&&(<>
                {/* Sub-tabs */}
                <div style={{ display:'flex', gap:0, borderBottom:'2px solid '+theme.border, marginBottom:'1.25rem' }}>
                  {(['ativos','inativos'] as const).map(st=>(
                    <button key={st} onClick={()=>{setColabSubTab(st);setColabPage(1)}} style={{ height:'40px', padding:'0 18px', background:'none', border:'none', borderBottom:colabSubTab===st?'2px solid '+theme.btn:'2px solid transparent', marginBottom:'-2px', color:colabSubTab===st?theme.btn:theme.textMuted, fontSize:'13px', fontWeight:colabSubTab===st?700:400, cursor:'pointer' }}>
                      {st==='ativos'?`Ativos (${ativos.length})`:`Inativos (${inativos.length})`}
                    </button>
                  ))}
                </div>

                {/* ─ ATIVOS ─ */}
                {colabSubTab==='ativos'&&(<>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
                    <div>
                      <h2 style={{ ...T.title, fontSize:'20px' }}>Colaboradores ativos</h2>
                    </div>
                    <button onClick={()=>{resetFormColab();setEditingColab(null);setColabView('form')}} style={{ ...btnMd(theme.btn,theme.btnText) }}>+ Adicionar colaborador</button>
                  </div>
                  <div style={{ display:'flex', gap:'8px', marginBottom:'1rem' }}>
                    <input style={{ ...T.input, flex:1 }} type="text" placeholder="Pesquisar por nome..." value={colabSearch} onChange={e=>{setColabSearch(e.target.value);setColabPage(1)}}/>
                    {colabSearch&&<button onClick={()=>{setColabSearch('');setColabPage(1)}} style={{ height:'38px', padding:'0 12px', background:theme.bg, border:'1px solid '+theme.border, borderRadius:'8px', color:theme.text, fontSize:'13px', cursor:'pointer', flexShrink:0 }}>Limpar</button>}
                  </div>
                  {ativos.length===0?(
                    <div style={{ ...T.card2, padding:'3rem', textAlign:'center' }}>
                      <div style={{ fontSize:'40px', marginBottom:'12px' }}>👤</div>
                      <p style={{ fontSize:'16px', fontWeight:700, color:theme.text, marginBottom:'4px' }}>Nenhum colaborador ativo</p>
                      <p style={{ fontSize:'13px', color:theme.textMuted }}>Adicione o primeiro colaborador para começar.</p>
                    </div>
                  ):paginatedAtivos.length===0?(
                    <div style={{ ...T.card2, padding:'2rem', textAlign:'center' }}>
                      <p style={{ fontSize:'14px', color:theme.textMuted, margin:0 }}>Nenhum colaborador encontrado para "{colabSearch}"</p>
                    </div>
                  ):(
                    <div style={{ ...T.card2, overflow:'hidden' }}>
                      {paginatedAtivos.map((c,i)=>(
                        <div key={c.id} style={{ borderBottom:i<paginatedAtivos.length-1?'1px solid '+theme.border:'none' }}>
                          {/* Accordion header */}
                          <div onClick={()=>setExpandedColabId(expandedColabId===c.id?null:c.id)} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'3px 16px', cursor:'pointer' }}>
                            <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:theme.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:700, color:theme.btn, flexShrink:0 }}>{c.nome.charAt(0)}</div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <p style={{ fontSize:'13px', fontWeight:700, color:theme.text, margin:0 }}>{c.nome}</p>
                              <p style={{ fontSize:'11px', color:theme.textMuted, margin:'1px 0 0 0' }}>{c.cargo} · {c.departamento}</p>
                            </div>
                            <span style={{ fontSize:'20px', color:theme.textMuted, opacity:.55, transition:'transform .25s ease', display:'inline-block', transform:expandedColabId===c.id?'rotate(90deg)':'rotate(0deg)', lineHeight:1, userSelect:'none' }}>›</span>
                          </div>
                          {/* Accordion body */}
                          {expandedColabId===c.id&&(
                            <div style={{ padding: isMobile ? '0 12px 12px 12px' : '0 16px 12px 64px', borderTop:'1px solid '+theme.border, background:theme.bg }}>
                              <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap:'10px 16px', margin:'10px 0' }}>
                                {[['Contrato',CONTRATO_LABELS[c.tipoContrato]],['Admissão',c.dataAdmissao],['Telefone',c.telefone],['E-mail',c.email]].map(([lbl,val])=>(
                                  <div key={lbl}>
                                    <p style={{ fontSize:'10px', fontWeight:700, color:theme.textMuted, textTransform:'uppercase', letterSpacing:'.05em', margin:'0 0 2px 0' }}>{lbl}</p>
                                    <p style={{ fontSize:'13px', color:theme.text, margin:0 }}>{val}</p>
                                  </div>
                                ))}
                              </div>
                              <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
                                <button onClick={()=>{setSelectedColab(c);setColabDetailTab('dados');setColabView('detail')}} style={btnSm(theme.btn,theme.btnText)}>Ver detalhes</button>
                                <button onClick={()=>{setDeactivateTarget(c.id);setDeactivateDate('');setDeactivateMotivo(MOTIVO_SAIDA[0]);setDeactivateErr('')}} style={btnSm('#fff3cd','#92400e')}>Desativar</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {/* Pagination */}
                      {totalPages>1&&(
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderTop:'1px solid '+theme.border }}>
                          <button disabled={colabPage===1} onClick={()=>setColabPage(p=>p-1)} style={{ height:'32px', padding:'0 12px', background:colabPage===1?theme.bg:theme.btn, color:colabPage===1?theme.textMuted:theme.btnText, border:'1px solid '+theme.border, borderRadius:'6px', fontSize:'13px', cursor:colabPage===1?'default':'pointer', opacity:colabPage===1?.5:1 }}>← Anterior</button>
                          <span style={{ fontSize:'13px', color:theme.textMuted }}>Página {colabPage} de {totalPages}</span>
                          <button disabled={colabPage===totalPages} onClick={()=>setColabPage(p=>p+1)} style={{ height:'32px', padding:'0 12px', background:colabPage===totalPages?theme.bg:theme.btn, color:colabPage===totalPages?theme.textMuted:theme.btnText, border:'1px solid '+theme.border, borderRadius:'6px', fontSize:'13px', cursor:colabPage===totalPages?'default':'pointer', opacity:colabPage===totalPages?.5:1 }}>Próximo →</button>
                        </div>
                      )}
                    </div>
                  )}
                </>)}

                {/* ─ INATIVOS ─ */}
                {colabSubTab==='inativos'&&(
                  <div>
                    <h2 style={{ ...T.title, fontSize:'20px', marginBottom:'1rem' }}>Colaboradores inativos</h2>
                    {inativos.length===0?(
                      <div style={{ ...T.card2, padding:'3rem', textAlign:'center' }}>
                        <div style={{ fontSize:'40px', marginBottom:'12px' }}>✅</div>
                        <p style={{ fontSize:'16px', fontWeight:700, color:theme.text, marginBottom:'4px' }}>Nenhum colaborador inativo</p>
                        <p style={{ fontSize:'13px', color:theme.textMuted }}>Não existem colaboradores desativados.</p>
                      </div>
                    ):(
                      <div style={{ ...T.card2, overflow:'hidden' }}>
                        {inativos.map((c,i)=>(
                          <div key={c.id} style={{ display:'flex', alignItems:'center', gap:'14px', padding:'10px 16px', borderBottom:i<inativos.length-1?'1px solid '+theme.border:'none' }}>
                            <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:theme.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:700, color:theme.textMuted, flexShrink:0 }}>{c.nome.charAt(0)}</div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <p style={{ fontSize:'13px', fontWeight:700, color:theme.text, margin:'0 0 1px 0' }}>{c.nome}</p>
                              <p style={{ fontSize:'11px', color:theme.textMuted, margin:0 }}>{c.cargo} · {c.departamento}</p>
                              <p style={{ fontSize:'11px', color:theme.textMuted, margin:'2px 0 0 0' }}>
                                Saiu em {c.dataSaida} · {c.motivoSaida}
                              </p>
                            </div>
                            <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                              <button onClick={()=>reativarColaborador(c.id)} style={btnSm('#d1fae5','#065f46')}>Reativar</button>
                              <button onClick={()=>setPermanentDeleteTarget(c.id)} style={btnSm('#fef2f2','#b91c1c')}>Excluir</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>)}

              {/* ── FORM VIEW ── */}
              {colabView==='form'&&(
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'1.5rem' }}>
                    <button onClick={()=>{if(editingColab){setEditingColab(null);setColabView('detail')}else{resetFormColab();setColabView('list')}}} style={T.backBtn}><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>{editingColab?'Voltar ao detalhe':'Voltar à lista'}</button>
                    <span style={{ color:theme.border }}>|</span>
                    <h2 style={{ ...T.title, fontSize:'20px' }}>{editingColab?'Editar colaborador':'Novo colaborador'}</h2>
                  </div>
                  <div style={{ ...T.card2, padding:'1.5rem' }}>
                    {formColabErr&&<div style={{ ...s.alertErr, marginBottom:'12px' }}>{formColabErr}</div>}
                    <p style={T.sectionLbl}>Dados profissionais</p>
                    <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'10px', marginBottom:'0.875rem' }}>
                      <div><label style={T.label}>Nome completo *</label><input style={T.input} type="text" placeholder="Ex: Ana Costa" value={fNome} onChange={e=>setFNome(e.target.value)}/></div>
                      <div><label style={T.label}>NIF *</label><input style={T.input} type="text" placeholder="NIF" value={fNif} onChange={e=>setFNif(e.target.value)}/></div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'10px', marginBottom:'0.875rem' }}>
                      <div><label style={T.label}>Cargo *</label><input style={T.input} type="text" placeholder="Ex: Enfermeira" value={fCargo} onChange={e=>setFCargo(e.target.value)}/></div>
                      <div><label style={T.label}>Departamento *</label><input style={T.input} type="text" placeholder="Ex: Clínica" value={fDept} onChange={e=>setFDept(e.target.value)}/></div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'10px', marginBottom:'0.875rem' }}>
                      <div><label style={T.label}>E-mail *</label><input style={T.input} type="email" placeholder="colaborador@empresa.pt" value={fEmail} onChange={e=>setFEmail(e.target.value)}/></div>
                      <div><label style={T.label}>Telefone *</label><input style={T.input} type="tel" placeholder="+351 912 000 000" value={fTel} onChange={e=>setFTel(e.target.value)}/></div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'10px', marginBottom:'0.875rem' }}>
                      <div><label style={T.label}>Data de admissão *</label><input style={T.input} type="date" value={fDataAdm} onChange={e=>setFDataAdm(e.target.value)}/></div>
                      <div>
                        <label style={T.label}>Tipo de contrato</label>
                        <select style={T.select} value={fContrato} onChange={e=>setFContrato(e.target.value as Colaborador['tipoContrato'])}>
                          {Object.entries(CONTRATO_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                    </div>
                    <p style={{ ...T.sectionLbl, marginTop:'12px' }}>Morada</p>
                    <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '2fr 1fr 1fr', gap:'10px', marginBottom:'0.875rem' }}>
                      <div style={{ gridColumn: isMobile ? '1/-1' : 'auto' }}><label style={T.label}>Rua / Avenida</label><input style={T.input} type="text" placeholder="Ex: Rua das Flores" value={fRua} onChange={e=>setFRua(e.target.value)}/></div>
                      <div><label style={T.label}>Número</label><input style={T.input} type="text" placeholder="10" value={fNumero} onChange={e=>setFNumero(e.target.value)}/></div>
                      <div><label style={T.label}>Andar / Fração</label><input style={T.input} type="text" placeholder="1º Esq" value={fAndar} onChange={e=>setFAndar(e.target.value)}/></div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap:'10px', marginBottom:'1.5rem' }}>
                      <div><label style={T.label}>Código Postal</label><input style={T.input} type="text" placeholder="1100-150" value={fCP} onChange={e=>setFCP(e.target.value)}/></div>
                      <div><label style={T.label}>Localidade</label><input style={T.input} type="text" placeholder="Lisboa" value={fLocalidade} onChange={e=>setFLocalidade(e.target.value)}/></div>
                      <div style={{ gridColumn: isMobile ? '1/-1' : 'auto' }}><label style={T.label}>Distrito</label><input style={T.input} type="text" placeholder="Lisboa" value={fDistrito} onChange={e=>setFDistrito(e.target.value)}/></div>
                    </div>
                    <div style={{ display:'flex', gap:'8px' }}>
                      <button onClick={editingColab?atualizarColaborador:adicionarColaborador} style={{ flex:1, height:'40px', background:theme.btn, border:'none', borderRadius:'8px', color:theme.btnText, fontSize:'14px', fontWeight:700, cursor:'pointer' }}>
                        {editingColab?'Guardar alterações':'Guardar colaborador'}
                      </button>
                      <button onClick={()=>{if(editingColab){setEditingColab(null);setColabView('detail')}else{resetFormColab();setColabView('list')}}} style={{ height:'40px', padding:'0 16px', background:theme.bg, border:'1px solid '+theme.border, borderRadius:'8px', color:theme.text, fontSize:'13px', cursor:'pointer' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── DETAIL VIEW ── */}
              {colabView==='detail'&&selectedColab&&(
                <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
                  <button onClick={()=>{setColabView('list');setSelectedColab(null)}} style={T.backBtn}><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>Voltar à lista</button>
                  {/* Header card */}
                  <div style={{ ...T.card2, padding:'1rem 1.25rem', marginBottom:'1rem' }}>
                    <div style={{ display:'flex', alignItems: isMobile ? 'flex-start' : 'center', gap:'14px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                      <div style={{ width:'48px', height:'48px', borderRadius:'50%', background:theme.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', fontWeight:700, color:theme.btn, flexShrink:0 }}>{selectedColab.nome.charAt(0)}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <h2 style={{ ...T.title, fontSize:'17px', marginBottom:'3px' }}>{selectedColab.nome}</h2>
                        <p style={{ fontSize:'12px', color:theme.textMuted, margin:0, display:'flex', flexWrap:'wrap', gap:'4px', alignItems:'center' }}>
                          <span>{selectedColab.cargo} · {selectedColab.departamento}</span>
                          <span style={{ background:theme.bg, borderRadius:'20px', padding:'2px 7px', fontSize:'11px', border:'1px solid '+theme.border }}>{CONTRATO_LABELS[selectedColab.tipoContrato]}</span>
                        </p>
                      </div>
                      <div style={{ display:'flex', gap:'8px', flexShrink:0, width: isMobile ? '100%' : 'auto' }}>
                        <button onClick={()=>iniciarEdicao(selectedColab)} style={{ ...btnMd(theme.bg,theme.text), flex: isMobile ? 1 : 'none' }}>✏️ Editar</button>
                        <button onClick={()=>{setDeactivateTarget(selectedColab.id);setDeactivateDate('');setDeactivateMotivo(MOTIVO_SAIDA[0]);setDeactivateErr('')}} style={{ ...btnMd('#fff3cd','#92400e'), flex: isMobile ? 1 : 'none' }}>Desativar</button>
                      </div>
                    </div>
                  </div>
                  {/* Detail tabs */}
                  <div style={{ ...T.card2, overflow:'hidden', flex:1, display:'flex', flexDirection:'column' }}>
                    <div style={{ display:'flex', padding:'0 1.5rem', borderBottom:'1px solid '+theme.border, flexShrink:0 }}>
                      {(['dados','documentos'] as const).map(tab=>(
                        <button key={tab} onClick={()=>setColabDetailTab(tab)} style={{ height:'44px', padding:'0 16px', background:'none', border:'none', borderBottom:colabDetailTab===tab?'2px solid '+theme.btn:'2px solid transparent', color:colabDetailTab===tab?theme.btn:theme.textMuted, fontSize:'13px', fontWeight:colabDetailTab===tab?700:400, cursor:'pointer' }}>
                          {tab==='dados'?'📋 Dados':`📁 Documentos (${selectedColab.documentos.length})`}
                        </button>
                      ))}
                    </div>
                    {colabDetailTab==='dados'&&(
                      <div style={{ padding:'1.5rem', flex:1, overflowY:'auto' }}>
                        <p style={T.sectionLbl}>Dados profissionais</p>
                        <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap:'16px 20px', marginBottom:'1.5rem' }}>
                          <InfoField label="Nome" value={selectedColab.nome} color={theme.text}/>
                          <InfoField label="NIF" value={selectedColab.nif} color={theme.text}/>
                          <InfoField label="Cargo" value={selectedColab.cargo} color={theme.text}/>
                          <InfoField label="Departamento" value={selectedColab.departamento} color={theme.text}/>
                          <InfoField label="Data de admissão" value={selectedColab.dataAdmissao} color={theme.text}/>
                          <InfoField label="Tipo de contrato" value={CONTRATO_LABELS[selectedColab.tipoContrato]} color={theme.text}/>
                        </div>
                        <p style={T.sectionLbl}>Contactos</p>
                        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap:'16px 20px', marginBottom:'1.5rem' }}>
                          <InfoField label="E-mail" value={selectedColab.email} color={theme.text}/>
                          <InfoField label="Telefone" value={selectedColab.telefone} color={theme.text}/>
                        </div>
                        <p style={T.sectionLbl}>Morada</p>
                        <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap:'16px 20px' }}>
                          <InfoField label="Rua / Avenida" value={selectedColab.morada.rua} color={theme.text}/>
                          <InfoField label="Número" value={selectedColab.morada.numero} color={theme.text}/>
                          <InfoField label="Andar / Fração" value={selectedColab.morada.andar} color={theme.text}/>
                          <InfoField label="Código Postal" value={selectedColab.morada.codigoPostal} color={theme.text}/>
                          <InfoField label="Localidade" value={selectedColab.morada.localidade} color={theme.text}/>
                          <InfoField label="Distrito" value={selectedColab.morada.distrito} color={theme.text}/>
                        </div>
                      </div>
                    )}
                    {colabDetailTab==='documentos'&&(
                      <div style={{ padding:'1.5rem', flex:1, overflowY:'auto' }}>
                        <p style={T.sectionLbl}>Adicionar documento</p>
                        <div style={{ background:theme.bg, borderRadius:'10px', border:'1px dashed '+theme.border, padding:'1.25rem', marginBottom:'1.5rem' }}>
                          {uploadErr&&<div style={{ ...s.alertErr, marginBottom:'10px' }}>{uploadErr}</div>}
                          <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:'10px', marginBottom:'10px' }}>
                            <div><label style={T.label}>Nome do documento *</label><input style={T.input} type="text" placeholder="Ex: Contrato 2024, BI frente, Recibo março" value={uploadNome} onChange={e=>setUploadNome(e.target.value)}/></div>
                          </div>
                          <div style={{ display:'flex', flexDirection: isMobile ? 'column' : 'row', gap:'10px', alignItems: isMobile ? 'stretch' : 'flex-end' }}>
                            <div style={{ flex:1 }}>
                              <label style={T.label}>Ficheiro * (PDF, JPG, JPEG, PNG)</label>
                              <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                                <button onClick={()=>fileInputRef.current?.click()} style={{ height:'38px', padding:'0 14px', background:theme.card, border:'1px solid '+theme.border, borderRadius:'8px', color:theme.text, fontSize:'13px', cursor:'pointer', whiteSpace:'nowrap' as const }}>📎 Escolher ficheiro</button>
                                <span style={{ fontSize:'12px', color:uploadFile?theme.text:theme.textMuted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'160px' }}>{uploadFile?uploadFile.name:'Nenhum ficheiro selecionado'}</span>
                                <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display:'none' }} onChange={e=>setUploadFile(e.target.files?.[0]??null)}/>
                              </div>
                            </div>
                            <button onClick={adicionarDocumento} style={{ height:'38px', padding:'0 18px', background:theme.btn, border:'none', borderRadius:'8px', color:theme.btnText, fontSize:'13px', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' as const }}>Adicionar</button>
                          </div>
                        </div>
                        {selectedColab.documentos.length===0?(
                          <div style={{ textAlign:'center', padding:'2rem', color:theme.textMuted }}>
                            <p style={{ fontSize:'32px', marginBottom:'8px' }}>📁</p>
                            <p style={{ fontSize:'13px' }}>Nenhum documento adicionado ainda.</p>
                          </div>
                        ):(
                          <>
                            <p style={T.sectionLbl}>Documentos ({selectedColab.documentos.length})</p>
                            {selectedColab.documentos.map(doc=>(
                              <div key={doc.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', border:'1px solid '+theme.border, borderRadius:'8px', marginBottom:'6px', background:theme.card }}>
                                <span style={{ fontSize:'22px', flexShrink:0 }}>{iconeDoc(doc.fileName)}</span>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <p style={{ fontSize:'13px', fontWeight:600, color:theme.text, margin:'0 0 2px 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.nome}</p>
                                  <p style={{ fontSize:'11px', color:theme.textMuted, margin:0 }}>{doc.fileName} · {doc.dataUpload}</p>
                                </div>
                                <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                                  {doc.fileObj&&<button onClick={()=>abrirDocumento(doc)} style={btnSm(theme.bg,theme.btn)}>Abrir</button>}
                                  <button onClick={()=>removerDocumento(doc.id)} style={btnSm('#fef2f2','#b91c1c')}>Remover</button>
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
            </div>)}

            {/* ═══ DADOS DA EMPRESA ═══ */}
            {dashTab==='empresa'&&(
              <div style={{ flex:1 }}>
                <h2 style={{ ...T.title, marginBottom:'1.5rem' }}>Dados da Empresa</h2>
                {empresaMsg&&(
                  <div style={{ ...(empresaMsg.startsWith('ok:') ? s.alertOk : s.alertErr), marginBottom:'1rem' }}>
                    {empresaMsg.replace(/^(ok|err):/, '')}
                  </div>
                )}
                <div style={{ ...T.card2, padding:'1.5rem', maxWidth:'680px' }}>
                  <p style={T.sectionLbl}>Identificação</p>
                  <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'10px', marginBottom:'0.875rem' }}>
                    <div style={{ gridColumn:'1/-1' }}>
                      <label style={T.label}>Nome da empresa *</label>
                      <input style={T.input} type="text" placeholder="Nome da empresa" value={eNome} onChange={e=>setENome(e.target.value)}/>
                    </div>
                    <div>
                      <label style={T.label}>NIF</label>
                      <input style={T.input} type="text" placeholder="NIF" value={eNif} onChange={e=>setENif(e.target.value)}/>
                    </div>
                    <div>
                      <label style={T.label}>Telefone</label>
                      <input style={T.input} type="tel" placeholder="+351 21 000 0000" value={eTel} onChange={e=>setETel(e.target.value)}/>
                    </div>
                  </div>
                  <p style={{ ...T.sectionLbl, marginTop:'12px' }}>Morada</p>
                  <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '2fr 1fr 1fr', gap:'10px', marginBottom:'0.875rem' }}>
                    <div style={{ gridColumn: isMobile ? '1/-1' : 'auto' }}><label style={T.label}>Rua / Avenida</label><input style={T.input} type="text" placeholder="Ex: Rua Augusta" value={eRua} onChange={e=>setERua(e.target.value)}/></div>
                    <div><label style={T.label}>Número</label><input style={T.input} type="text" placeholder="42" value={eNumero} onChange={e=>setENumero(e.target.value)}/></div>
                    <div><label style={T.label}>Andar / Fração</label><input style={T.input} type="text" placeholder="2º Dto" value={eAndar} onChange={e=>setEAndar(e.target.value)}/></div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap:'10px', marginBottom:'1.5rem' }}>
                    <div><label style={T.label}>Código Postal</label><input style={T.input} type="text" placeholder="1100-150" value={eCP} onChange={e=>setECP(e.target.value)}/></div>
                    <div><label style={T.label}>Localidade</label><input style={T.input} type="text" placeholder="Lisboa" value={eLocalidade} onChange={e=>setELocalidade(e.target.value)}/></div>
                    <div style={{ gridColumn: isMobile ? '1/-1' : 'auto' }}><label style={T.label}>Distrito</label><input style={T.input} type="text" placeholder="Lisboa" value={eDistrito} onChange={e=>setEDistrito(e.target.value)}/></div>
                  </div>
                  <button onClick={saveEmpresa} style={{ height:'40px', padding:'0 24px', background:theme.btn, color:theme.btnText, border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>
                    Guardar alterações
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    )
  }

  return null
}
