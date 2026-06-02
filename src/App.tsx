import { useState, useEffect, useRef } from 'react';
import Icon from '@/components/ui/icon';

type Screen = 'scan' | 'mode' | 'training' | 'calibration' | 'stats' | 'settings';
type TargetStatus = 'closed' | 'open' | 'hit';
type TrainingMode = 'sequential' | 'random' | 'reaction' | 'sniper' | 'endurance' | null;

interface Device {
  id: string;
  name: string;
  rssi: number;
}

interface Target {
  id: number;
  status: TargetStatus;
  hits: number;
}

interface TrainingSession {
  id: string;
  date: string;
  mode: string;
  hits: number;
  duration: number;
  accuracy: number;
}

const MODES = [
  { id: 'sequential', name: 'Последовательный', icon: 'AlignJustify', desc: 'Мишени открываются по очереди слева направо', color: '#00c8ff', bg: 'rgba(0,200,255,0.07)', difficulty: 'Легко' },
  { id: 'random', name: 'Случайный', icon: 'Shuffle', desc: 'Мишени открываются в случайном порядке и времени', color: '#ff6b1a', bg: 'rgba(255,107,26,0.08)', difficulty: 'Средне' },
  { id: 'reaction', name: 'Реакция', icon: 'Zap', desc: 'Одна мишень на 1.5 сек — максимальная скорость реакции', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', difficulty: 'Сложно' },
  { id: 'sniper', name: 'Снайпер', icon: 'Crosshair', desc: 'Точность важнее скорости. Долгие паузы между мишенями', color: '#00c8ff', bg: 'rgba(0,200,255,0.07)', difficulty: 'Средне' },
  { id: 'endurance', name: 'Выносливость', icon: 'Timer', desc: 'Все мишени открыты — 5 минут непрерывной работы', color: '#ff6b1a', bg: 'rgba(255,107,26,0.08)', difficulty: 'Тяжело' },
];

const MOCK_HISTORY: TrainingSession[] = [
  { id: '1', date: '2 июня', mode: 'Случайный', hits: 47, duration: 180, accuracy: 78 },
  { id: '2', date: '1 июня', mode: 'Реакция', hits: 31, duration: 120, accuracy: 65 },
  { id: '3', date: '31 мая', mode: 'Снайпер', hits: 22, duration: 240, accuracy: 92 },
  { id: '4', date: '30 мая', mode: 'Последовательный', hits: 55, duration: 200, accuracy: 88 },
  { id: '5', date: '29 мая', mode: 'Выносливость', hits: 103, duration: 300, accuracy: 71 },
];

function SignalBars({ rssi }: { rssi: number }) {
  const strength = rssi > -60 ? 4 : rssi > -70 ? 3 : rssi > -80 ? 2 : 1;
  return (
    <div className="flex items-end gap-0.5" style={{ height: 16 }}>
      {[1, 2, 3, 4].map(b => (
        <div key={b} style={{ width: 4, height: 4 + b * 3, borderRadius: 1, background: b <= strength ? '#00c8ff' : 'rgba(255,255,255,0.15)' }} />
      ))}
    </div>
  );
}

function BatteryWidget({ level }: { level: number }) {
  const color = level > 50 ? '#00c8ff' : level > 20 ? '#ff6b1a' : '#ef4444';
  return (
    <div className="flex items-center gap-1.5">
      <div style={{ width: 24, height: 12, borderRadius: 2, border: `1.5px solid ${color}`, position: 'relative', display: 'flex', alignItems: 'center', padding: '1px' }}>
        <div style={{ position: 'absolute', right: -5, top: 3, width: 3, height: 6, background: color, borderRadius: '0 1px 1px 0' }} />
        <div style={{ width: `${level}%`, height: '100%', background: color, borderRadius: 1, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ color, fontSize: 12, fontFamily: 'Roboto Mono' }}>{level}%</span>
    </div>
  );
}

function TargetCircle({ target, onTap }: { target: Target; onTap: () => void }) {
  const size = 66;
  const statusClass = target.status === 'open' ? 'target-open' : target.status === 'hit' ? 'target-hit' : 'target-closed';
  return (
    <button onClick={onTap} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className={statusClass} style={{ width: size, height: size }}>
        {[size * 0.85, size * 0.6, size * 0.35].map((r, i) => (
          <div key={i} style={{ position: 'absolute', width: r, height: r, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        ))}
        <span style={{ fontFamily: 'Oswald', fontSize: 20, fontWeight: 700, color: target.status === 'hit' ? '#1c1917' : target.status === 'open' ? '#a5f3ff' : '#fca5a5', position: 'relative', zIndex: 2 }}>
          {target.id}
        </span>
      </div>
      {target.hits > 0 && (
        <div style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: 'Roboto Mono', border: '1.5px solid rgba(0,0,0,0.4)', zIndex: 10 }}>
          {target.hits}
        </div>
      )}
    </button>
  );
}

function MiniChart({ data, color = '#00c8ff' }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const w = 260, h = 70;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 8) - 4}`).join(' ');
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`g${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => (
        <circle key={i} cx={(i / (data.length - 1)) * w} cy={h - (v / max) * (h - 8) - 4} r={3.5} fill={color} />
      ))}
    </svg>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('scan');
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [connected, setConnected] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [selectedMode, setSelectedMode] = useState<TrainingMode>(null);
  const [targets, setTargets] = useState<Target[]>([1, 2, 3, 4, 5].map(i => ({ id: i, status: 'closed' as TargetStatus, hits: 0 })));
  const [score, setScore] = useState(0);
  const [battery] = useState(72);
  const [trainingActive, setTrainingActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [calAngles, setCalAngles] = useState([90, 90, 90, 90, 90]);
  const [calStep, setCalStep] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startScan = () => {
    setScanning(true);
    setDevices([]);
    setTimeout(() => {
      setDevices([
        { id: '1', name: 'TactTarget-Pro', rssi: -52 },
        { id: '2', name: 'TactTarget-001', rssi: -68 },
        { id: '3', name: 'ShootSys-A3', rssi: -81 },
      ]);
      setScanning(false);
    }, 2200);
  };

  const connectDevice = (device: Device) => {
    setConnectedDevice(device);
    setConnected(true);
    setTimeout(() => setScreen('mode'), 500);
  };

  const startTraining = () => {
    if (!selectedMode) return;
    setScreen('training');
    setScore(0);
    setElapsed(0);
    setTargets([1, 2, 3, 4, 5].map(i => ({ id: i, status: 'closed' as TargetStatus, hits: 0 })));
    setTrainingActive(true);
  };

  const toggleTarget = (id: number) => {
    setTargets(prev => prev.map(t => {
      if (t.id !== id) return t;
      return { ...t, status: t.status === 'closed' ? 'open' : 'closed' };
    }));
  };

  const simulateHit = (id: number) => {
    setTargets(prev => prev.map(t => t.id === id ? { ...t, status: 'hit' as TargetStatus, hits: t.hits + 1 } : t));
    setScore(s => s + 1);
    setTimeout(() => {
      setTargets(prev => prev.map(t => t.id === id ? { ...t, status: 'closed' as TargetStatus } : t));
    }, 700);
  };

  const openAll = () => setTargets(prev => prev.map(t => ({ ...t, status: 'open' as TargetStatus })));
  const closeAll = () => setTargets(prev => prev.map(t => ({ ...t, status: 'closed' as TargetStatus })));
  const randomMode = () => {
    const idx = Math.floor(Math.random() * 5);
    setTargets(prev => prev.map((t, i) => ({ ...t, status: (i === idx ? 'open' : 'closed') as TargetStatus })));
  };
  const stopTraining = () => { setTrainingActive(false); };

  useEffect(() => {
    if (trainingActive) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [trainingActive]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const hitsData = MOCK_HISTORY.map(h => h.hits).reverse();
  const accData = MOCK_HISTORY.map(h => h.accuracy).reverse();

  return (
    <div style={{ minHeight: '100vh', maxWidth: 430, margin: '0 auto', position: 'relative', paddingBottom: 72 }}>

      {/* ── SCAN ─────────────────────────────────── */}
      {screen === 'scan' && (
        <div className="animate-fade-in" style={{ padding: '48px 20px 24px' }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
              <div style={{ width: 3, height: 28, background: '#00c8ff', borderRadius: 2 }} />
              <h1 className="screen-header" style={{ color: '#00c8ff', margin: 0 }}>TactShoot</h1>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, letterSpacing: '0.1em', paddingLeft: 13 }}>BLUETOOTH ПОДКЛЮЧЕНИЕ · BLE FFE0</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
            <div style={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {scanning && [0, 0.6, 1.2].map(delay => (
                <div key={delay} className="scan-ring" style={{ width: 40, height: 40, animationDelay: `${delay}s` }} />
              ))}
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: connected ? 'rgba(0,200,255,0.12)' : 'rgba(255,255,255,0.04)', border: `2px solid ${connected ? '#00c8ff' : 'rgba(255,255,255,0.12)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: connected ? '0 0 24px rgba(0,200,255,0.35)' : 'none', transition: 'all 0.4s ease' }}>
                <Icon name="Bluetooth" size={28} style={{ color: connected ? '#00c8ff' : 'rgba(255,255,255,0.35)' }} />
              </div>
            </div>
          </div>

          {connected && connectedDevice && (
            <div className="glass-panel animate-slide-up" style={{ padding: '13px 16px', borderRadius: 10, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#00c8ff', boxShadow: '0 0 8px #22c55e', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Oswald', fontSize: 14, fontWeight: 600, color: '#fff' }}>{connectedDevice.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Подключено · RSSI {connectedDevice.rssi} dBm</div>
              </div>
              <SignalBars rssi={connectedDevice.rssi} />
            </div>
          )}

          {devices.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', marginBottom: 10, textTransform: 'uppercase' }}>
                Найдено устройств: {devices.length}
              </div>
              {devices.map((d, i) => (
                <button key={d.id} className="device-item" onClick={() => connectDevice(d)} style={{ width: '100%', marginBottom: i < devices.length - 1 ? 8 : 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(0,200,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="Crosshair" size={18} style={{ color: '#00c8ff' }} />
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontFamily: 'Oswald', fontSize: 15, color: '#fff', fontWeight: 500 }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>ID: {d.id} · {d.rssi} dBm</div>
                  </div>
                  <SignalBars rssi={d.rssi} />
                  <Icon name="ChevronRight" size={16} style={{ color: 'rgba(255,255,255,0.25)' }} />
                </button>
              ))}
            </div>
          )}

          {!scanning && devices.length === 0 && !connected && (
            <div style={{ textAlign: 'center', padding: '16px 0 24px', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
              Нажмите «Сканировать» для поиска устройств
            </div>
          )}

          <button
            onClick={connected ? () => setScreen('mode') : startScan}
            disabled={scanning}
            className="neon-btn"
            style={{ width: '100%', padding: '14px', borderRadius: 10, background: scanning ? 'rgba(0,200,255,0.07)' : 'rgba(0,200,255,0.9)', color: scanning ? '#00c8ff' : '#000', border: '1px solid rgba(0,200,255,0.4)', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {scanning ? <><Icon name="Loader2" size={18} style={{ animation: 'spin-slow 1s linear infinite' }} />Сканирование...</> : connected ? <><Icon name="Play" size={18} />Продолжить</> : <><Icon name="Search" size={18} />Сканировать</>}
          </button>
        </div>
      )}

      {/* ── MODE SELECTION ────────────────────────── */}
      {screen === 'mode' && (
        <div className="animate-fade-in" style={{ padding: '48px 20px 24px' }}>
          <div style={{ marginBottom: 24 }}>
            <button onClick={() => setScreen('scan')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, padding: 0 }}>
              <Icon name="ChevronLeft" size={18} /><span style={{ fontSize: 12 }}>Назад</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
              <div style={{ width: 3, height: 28, background: '#ff6b1a', borderRadius: 2 }} />
              <h1 className="screen-header" style={{ color: '#fff', margin: 0 }}>Режим тренировки</h1>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, paddingLeft: 13 }}>Выберите режим и нажмите «Начать»</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MODES.map((m) => (
              <button key={m.id} className={`mode-card ${selectedMode === m.id ? 'selected' : ''}`} onClick={() => setSelectedMode(m.id as TrainingMode)} style={{ background: selectedMode === m.id ? m.bg : 'rgba(255,255,255,0.02)', textAlign: 'left', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: m.bg, border: `1px solid ${m.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={m.icon} size={22} style={{ color: m.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontFamily: 'Oswald', fontSize: 16, color: '#fff', fontWeight: 600 }}>{m.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 4, background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}25`, fontFamily: 'Roboto' }}>{m.difficulty}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.45 }}>{m.desc}</p>
                  </div>
                </div>
                {selectedMode === m.id && <div style={{ position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: '50%', background: m.color, boxShadow: `0 0 8px ${m.color}` }} />}
              </button>
            ))}
          </div>

          <button onClick={startTraining} disabled={!selectedMode} className="neon-btn" style={{ width: '100%', marginTop: 18, padding: '14px', borderRadius: 10, background: selectedMode ? 'rgba(0,200,255,0.9)' : 'rgba(255,255,255,0.04)', color: selectedMode ? '#000' : 'rgba(255,255,255,0.2)', border: `1px solid ${selectedMode ? 'rgba(0,200,255,0.4)' : 'rgba(255,255,255,0.08)'}`, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: selectedMode ? 'pointer' : 'default', transition: 'all 0.2s' }}>
            <Icon name="Play" size={18} />Начать тренировку
          </button>
        </div>
      )}

      {/* ── TRAINING ─────────────────────────────── */}
      {screen === 'training' && (
        <div className="animate-fade-in" style={{ padding: '28px 16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
                {MODES.find(m => m.id === selectedMode)?.name || 'Тренировка'}
              </div>
              <div style={{ fontFamily: 'Roboto Mono', fontSize: 30, color: trainingActive ? '#00c8ff' : 'rgba(255,255,255,0.4)', fontWeight: 500, lineHeight: 1 }}>{fmt(elapsed)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Очки</div>
              <div style={{ fontFamily: 'Roboto Mono', fontSize: 30, color: '#ff6b1a', fontWeight: 500, lineHeight: 1 }}>{score}</div>
            </div>
            <BatteryWidget level={battery} />
          </div>

          {/* Игровая зона — разметка поля */}
          <div style={{ position: 'relative', borderRadius: 16, marginBottom: 14, overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.18)' }}>
            {/* SVG-разметка поля */}
            <svg
              viewBox="0 0 380 180"
              xmlns="http://www.w3.org/2000/svg"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
              preserveAspectRatio="none"
            >
              {/* Фон поля */}
              <rect width="380" height="180" fill="#000" />
              {/* Полосы травы */}
              {[0,1,2,3,4,5].map(i => (
                <rect key={i} x={i * 64} y="0" width="32" height="180" fill="rgba(255,255,255,0.025)" />
              ))}
              {/* Внешняя рамка */}
              <rect x="8" y="8" width="364" height="164" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
              {/* Центральная линия */}
              <line x1="190" y1="8" x2="190" y2="172" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
              {/* Центральный круг */}
              <circle cx="190" cy="90" r="38" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
              {/* Центральная точка */}
              <circle cx="190" cy="90" r="3" fill="rgba(255,255,255,0.7)" />
              {/* Левая штрафная */}
              <rect x="8" y="52" width="52" height="76" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" />
              {/* Левая вратарская */}
              <rect x="8" y="70" width="22" height="40" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
              {/* Левая точка пенальти */}
              <circle cx="44" cy="90" r="2.5" fill="rgba(255,255,255,0.6)" />
              {/* Левая дуга штрафной */}
              <path d="M 60 65 A 30 30 0 0 1 60 115" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
              {/* Правая штрафная */}
              <rect x="320" y="52" width="52" height="76" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" />
              {/* Правая вратарская */}
              <rect x="350" y="70" width="22" height="40" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
              {/* Правая точка пенальти */}
              <circle cx="336" cy="90" r="2.5" fill="rgba(255,255,255,0.6)" />
              {/* Правая дуга штрафной */}
              <path d="M 320 65 A 30 30 0 0 0 320 115" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
              {/* Угловые дуги */}
              <path d="M 8 18 A 10 10 0 0 1 18 8" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
              <path d="M 362 8 A 10 10 0 0 1 372 18" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
              <path d="M 8 162 A 10 10 0 0 0 18 172" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
              <path d="M 362 172 A 10 10 0 0 0 372 162" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
              {/* Голубое свечение центральной линии */}
              <line x1="190" y1="8" x2="190" y2="172" stroke="rgba(0,200,255,0.12)" strokeWidth="6" />
              <circle cx="190" cy="90" r="38" fill="none" stroke="rgba(0,200,255,0.1)" strokeWidth="5" />
            </svg>

            {/* Контент поверх поля */}
            <div style={{ position: 'relative', zIndex: 2, padding: '16px 16px 14px' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', marginBottom: 14, textTransform: 'uppercase', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                Мишени · тап = откр/закр
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                {targets.map(t => (
                  <div key={t.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <TargetCircle target={t} onTap={() => toggleTarget(t.id)} />
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: 'Roboto Mono', letterSpacing: '0.05em', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                      {t.status === 'open' ? 'ОТКР' : t.status === 'hit' ? 'ПОПАД' : 'ЗАКР'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 10 }}>
            {[
              { label: 'Открыть все', cmd: '0x10', onClick: openAll, color: '#00c8ff', icon: 'Eye' },
              { label: 'Закрыть все', cmd: '0x11', onClick: closeAll, color: '#ef4444', icon: 'EyeOff' },
              { label: 'Случайный', cmd: '0x14', onClick: randomMode, color: '#ff6b1a', icon: 'Shuffle' },
              { label: 'Стоп', cmd: '0x15', onClick: stopTraining, color: trainingActive ? '#ef4444' : 'rgba(255,255,255,0.25)', icon: 'Square' },
            ].map(btn => (
              <button key={btn.cmd} onClick={btn.onClick} className="neon-btn" style={{ padding: '11px', borderRadius: 9, background: `${btn.color}12`, color: btn.color, border: `1px solid ${btn.color}30`, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Icon name={btn.icon} size={15} />{btn.label} <span style={{ opacity: 0.5, fontSize: 10 }}>({btn.cmd})</span>
              </button>
            ))}
          </div>

          <div className="glass-panel" style={{ padding: '12px 14px', borderRadius: 10 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>
              Симуляция попадания 0x40 (demo)
            </div>
            <div style={{ display: 'flex', gap: 7 }}>
              {targets.map(t => (
                <button key={t.id} onClick={() => simulateHit(t.id)} style={{ flex: 1, padding: '8px 0', borderRadius: 7, background: 'rgba(255,107,26,0.08)', border: '1px solid rgba(255,107,26,0.2)', color: '#ff6b1a', fontSize: 14, fontFamily: 'Oswald', fontWeight: 600, cursor: 'pointer' }}>
                  {t.id}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CALIBRATION ──────────────────────────── */}
      {screen === 'calibration' && (
        <div className="animate-fade-in" style={{ padding: '48px 20px 24px' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
              <div style={{ width: 3, height: 28, background: '#818cf8', borderRadius: 2 }} />
              <h1 className="screen-header" style={{ color: '#fff', margin: 0 }}>Калибровка</h1>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, paddingLeft: 13 }}>Настройка углов сервоприводов</p>
          </div>

          <div style={{ display: 'flex', gap: 5, marginBottom: 24 }}>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= calStep ? '#818cf8' : 'rgba(255,255,255,0.08)', transition: 'background 0.3s ease' }} />
            ))}
          </div>

          <div className="glass-panel" style={{ padding: 20, borderRadius: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: 'Oswald', fontSize: 22, color: '#fff', fontWeight: 600 }}>Мишень {calStep + 1}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Шаг {calStep + 1} из 5</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Roboto Mono', fontSize: 38, color: '#818cf8', lineHeight: 1, fontWeight: 500 }}>{calAngles[calStep]}°</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>Угол открытия</div>
              </div>
            </div>

            <input type="range" min={0} max={180} value={calAngles[calStep]} onChange={e => { const v = [...calAngles]; v[calStep] = Number(e.target.value); setCalAngles(v); }} style={{ width: '100%', height: 6, cursor: 'pointer', accentColor: '#818cf8', marginBottom: 10 }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.2)', marginBottom: 14 }}>
              <span>0° Закрыто</span><span>90° Половина</span><span>180° Открыто</span>
            </div>

            <div style={{ display: 'flex', gap: 7 }}>
              {[0, 45, 90, 135, 180].map(a => (
                <button key={a} onClick={() => { const v = [...calAngles]; v[calStep] = a; setCalAngles(v); }} style={{ flex: 1, padding: '7px 0', borderRadius: 6, background: calAngles[calStep] === a ? 'rgba(129,140,248,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${calAngles[calStep] === a ? '#818cf8' : 'rgba(255,255,255,0.08)'}`, color: calAngles[calStep] === a ? '#818cf8' : 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer', fontFamily: 'Roboto Mono' }}>
                  {a}°
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
            {calAngles.map((a, i) => (
              <button key={i} onClick={() => setCalStep(i)} style={{ flex: 1, padding: '10px 4px', borderRadius: 8, cursor: 'pointer', background: i === calStep ? 'rgba(129,140,248,0.12)' : 'rgba(255,255,255,0.02)', border: `1px solid ${i === calStep ? '#818cf8' : 'rgba(255,255,255,0.06)'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <span style={{ fontFamily: 'Oswald', fontSize: 13, color: i === calStep ? '#818cf8' : 'rgba(255,255,255,0.4)' }}>M{i + 1}</span>
                <span style={{ fontFamily: 'Roboto Mono', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{a}°</span>
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            <button className="neon-btn" style={{ padding: '12px', borderRadius: 9, background: 'rgba(129,140,248,0.1)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.25)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="Send" size={15} />Применить (0x20)
            </button>
            <button onClick={() => setCalStep(s => Math.min(4, s + 1))} className="neon-btn" style={{ padding: '12px', borderRadius: 9, background: 'rgba(0,200,255,0.1)', color: '#00c8ff', border: '1px solid rgba(0,200,255,0.25)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {calStep < 4 ? 'Следующая' : 'Готово'}<Icon name="ChevronRight" size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ── STATS ────────────────────────────────── */}
      {screen === 'stats' && (
        <div className="animate-fade-in" style={{ padding: '48px 20px 24px' }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
              <div style={{ width: 3, height: 28, background: '#06b6d4', borderRadius: 2 }} />
              <h1 className="screen-header" style={{ color: '#fff', margin: 0 }}>Статистика</h1>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, paddingLeft: 13 }}>История тренировок</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9, marginBottom: 18 }}>
            {[{ label: 'Трен.', value: '5', icon: 'Calendar' }, { label: 'Попаданий', value: '258', icon: 'Target' }, { label: 'Точность', value: '79%', icon: 'Crosshair' }].map(c => (
              <div key={c.label} className="glass-panel" style={{ padding: '12px 8px', borderRadius: 10, textAlign: 'center' }}>
                <Icon name={c.icon} size={17} style={{ color: '#06b6d4', marginBottom: 4 }} />
                <div style={{ fontFamily: 'Roboto Mono', fontSize: 18, color: '#06b6d4', fontWeight: 500 }}>{c.value}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{c.label}</div>
              </div>
            ))}
          </div>

          <div className="glass-panel" style={{ padding: 16, borderRadius: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase' }}>Попадания по тренировкам</div>
            <MiniChart data={hitsData} color="#00c8ff" />
          </div>

          <div className="glass-panel" style={{ padding: 16, borderRadius: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase' }}>Точность %</div>
            <MiniChart data={accData} color="#06b6d4" />
          </div>

          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', marginBottom: 10, textTransform: 'uppercase' }}>Последние тренировки</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {MOCK_HISTORY.map((s) => (
              <div key={s.id} className="glass-panel" style={{ padding: '11px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(6,182,212,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="Target" size={17} style={{ color: '#06b6d4' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Oswald', fontSize: 14, color: '#fff', fontWeight: 500 }}>{s.mode}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{s.date} · {Math.floor(s.duration / 60)}:{String(s.duration % 60).padStart(2, '0')} мин</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Roboto Mono', fontSize: 16, color: '#00c8ff' }}>{s.hits}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{s.accuracy}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SETTINGS ─────────────────────────────── */}
      {screen === 'settings' && (
        <div className="animate-fade-in" style={{ padding: '48px 20px 24px' }}>
          <div style={{ marginBottom: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
              <div style={{ width: 3, height: 28, background: 'rgba(255,255,255,0.35)', borderRadius: 2 }} />
              <h1 className="screen-header" style={{ color: '#fff', margin: 0 }}>Настройки</h1>
            </div>
          </div>

          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', marginBottom: 10, textTransform: 'uppercase' }}>Устройство</div>
          <div className="glass-panel" style={{ padding: '14px 16px', borderRadius: 12, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: connected ? '#00c8ff' : '#ef4444', boxShadow: connected ? '0 0 8px #22c55e' : 'none', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#fff' }}>{connected ? connectedDevice?.name || 'Подключено' : 'Нет подключения'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {[['Версия прошивки', 'v2.4.1'], ['Версия приложения', '1.0.0'], ['UUID Сервис', 'FFE0'], ['UUID Battery', 'FFE4']].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{k}</span>
                  <span style={{ fontSize: 12, fontFamily: 'Roboto Mono', color: 'rgba(255,255,255,0.65)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', marginBottom: 10, textTransform: 'uppercase' }}>Параметры</div>
          <div className="glass-panel" style={{ padding: '4px 0', borderRadius: 12, marginBottom: 20 }}>
            {[
              { label: 'Звук попадания', desc: 'Звук при событии 0x40', val: soundEnabled, toggle: () => setSoundEnabled(v => !v), icon: 'Volume2' },
              { label: 'Уведомления', desc: 'Push-уведомления о статусе', val: notifEnabled, toggle: () => setNotifEnabled(v => !v), icon: 'Bell' },
            ].map((item, i) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', borderBottom: i < 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={item.icon} size={17} style={{ color: 'rgba(255,255,255,0.45)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 1 }}>{item.desc}</div>
                </div>
                <button onClick={item.toggle} style={{ width: 44, height: 24, borderRadius: 12, background: item.val ? '#00c8ff' : 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s ease', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', width: 18, height: 18, borderRadius: '50%', background: '#fff', top: 3, left: item.val ? 23 : 3, transition: 'left 0.2s ease', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                </button>
              </div>
            ))}
          </div>

          <div className="glass-panel" style={{ padding: '14px 16px', borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>Заряд батареи тренажера</span>
              <BatteryWidget level={battery} />
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${battery}%`, background: battery > 50 ? 'linear-gradient(90deg,#00c8ff,#7ee8fa)' : 'linear-gradient(90deg,#ff6b1a,#ffb347)' }} />
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM NAV ───────────────────────────── */}
      <nav className="bottom-nav">
        {([
          { id: 'scan', icon: 'Bluetooth', label: 'Связь' },
          { id: 'training', icon: 'Crosshair', label: 'Тренировка' },
          { id: 'calibration', icon: 'SlidersHorizontal', label: 'Калибровка' },
          { id: 'stats', icon: 'BarChart2', label: 'Статистика' },
          { id: 'settings', icon: 'Settings', label: 'Настройки' },
        ] as { id: Screen; icon: string; label: string }[]).map(nav => (
          <button
            key={nav.id}
            className={`nav-btn ${screen === nav.id || (nav.id === 'training' && screen === 'mode') ? 'active' : ''}`}
            onClick={() => {
              if (nav.id === 'training') { setScreen(connected ? 'mode' : 'scan'); } else { setScreen(nav.id); }
            }}
          >
            <Icon name={nav.icon} size={22} />
            <span>{nav.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}