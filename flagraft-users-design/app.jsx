/* global React, ReactDOM,
   TopBar, SideNav, CommandPalette, HelpPanel, ProjectSwitcher,
   FlagsScreen, FlagsScreenV2, FlagDetail,
   EnvironmentsScreen, KeysScreen, AuditScreen, OnboardingScreen, ErrorStatesScreen,
   SettingsScreen, DesignSystemScreen, LoginScreen, UsersScreen,
   ToastProvider, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakColor */
const { useState, useEffect, useCallback, useRef } = React;

function App() {
  const [theme, setTheme] = useState('light');
  const [project, setProject] = useState(window.PROJECTS[0]);
  const [activeEnv, setActiveEnv] = useState('development');
  const [route, setRoute] = useState({ id: 'flags' }); // { id, flagKey? }
  const [openNew, setOpenNew] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);
  const [openHelp, setOpenHelp] = useState(false);
  const [openSwitcher, setOpenSwitcher] = useState(false);

  // Tweaks
  const DEFAULTS = /*EDITMODE-BEGIN*/{
    "theme": "light",
    "density": "comfortable",
    "showAnnotations": true,
    "accent": "teal",
    "flagsLayout": "redesigned",
  }/*EDITMODE-END*/;
  const [tweaks, setTweak] = useTweaks(DEFAULTS);
  useEffect(() => { setTheme(tweaks.theme); }, [tweaks.theme]);
  useEffect(() => {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add('theme-' + theme);
  }, [theme]);

  // Accent customization
  useEffect(() => {
    const accents = {
      teal:   { 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', soft: '#f0fdfa', softBorder: '#cbeae3', fg: '#0f766e' },
      indigo: { 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', soft: '#eef2ff', softBorder: '#c7d2fe', fg: '#4338ca' },
      violet: { 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', soft: '#f5f3ff', softBorder: '#ddd6fe', fg: '#6d28d9' },
      rose:   { 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', soft: '#fff1f2', softBorder: '#fecdd3', fg: '#be123c' },
    };
    const a = accents[tweaks.accent] || accents.teal;
    const r = document.documentElement.style;
    r.setProperty('--teal-400', a[400]);
    r.setProperty('--teal-500', a[500]);
    r.setProperty('--teal-600', a[600]);
    r.setProperty('--teal-700', a[700]);
  }, [tweaks.accent]);

  // Density
  useEffect(() => {
    const css = document.documentElement.style;
    if (tweaks.density === 'compact') {
      css.setProperty('font-size', '13px');
    } else {
      css.setProperty('font-size', '14px');
    }
  }, [tweaks.density]);

  // Keyboard shortcuts
  useEffect(() => {
    const pending = { g: false };
    let gTimer;
    const onKey = (e) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable;

      // Always-on shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setOpenSearch(true); return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault(); setOpenSwitcher(true); return;
      }

      if (isTyping) return;

      if (e.key === '?') { e.preventDefault(); setOpenHelp(true); return; }
      if (e.key === '/') {
        e.preventDefault();
        const i = document.querySelector('.filter-input input');
        if (i) i.focus();
        return;
      }
      if (e.shiftKey && e.key.toLowerCase() === 'd') {
        setTheme((t) => (t === 'light' ? 'dark' : 'light'));
        setTweak('theme', theme === 'light' ? 'dark' : 'light');
        return;
      }
      if (e.key.toLowerCase() === 'n') { setOpenNew(true); return; }

      if (pending.g) {
        clearTimeout(gTimer);
        pending.g = false;
        const m = {
          f: 'flags', o: 'overrides', e: 'environments',
          k: 'keys', a: 'audit',
        };
        if (m[e.key.toLowerCase()]) {
          setRoute({ id: m[e.key.toLowerCase()] });
        }
        return;
      }
      if (e.key.toLowerCase() === 'g') {
        pending.g = true;
        gTimer = setTimeout(() => { pending.g = false; }, 800);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [theme, setTweak]);

  const handleNav = useCallback((id) => {
    if (id.startsWith('flag:')) { setRoute({ id: 'flag-detail', flagKey: id.split(':')[1] }); return; }
    if (id === 'flags:new') { setRoute({ id: 'flags' }); setOpenNew(true); return; }
    if (id === 'overrides:new') { setRoute({ id: 'flag-detail', flagKey: window.FLAGS[0].key }); return; }
    if (id === 'keys:new') { setRoute({ id: 'keys' }); return; }
    if (id === 'users:invite') { setRoute({ id: 'users' }); return; }
    setRoute({ id });
  }, []);

  let body;
  const FlagsList = tweaks.flagsLayout === 'classic' ? FlagsScreen : FlagsScreenV2;
  if (route.id === 'flags') body = <FlagsList activeEnv={activeEnv} onOpenFlag={(k) => setRoute({ id: 'flag-detail', flagKey: k })} openNew={openNew} setOpenNew={setOpenNew} showAnnotationsInitial={tweaks.showAnnotations}/>;
  else if (route.id === 'flag-detail') body = <FlagDetail flagKey={route.flagKey} onBack={() => setRoute({ id: 'flags' })}/>;
  else if (route.id === 'overrides') body = <FlagDetail flagKey={'checkout.new-cart'} onBack={() => setRoute({ id: 'flags' })}/>;
  else if (route.id === 'environments') body = <EnvironmentsScreen/>;
  else if (route.id === 'keys') body = <KeysScreen/>;
  else if (route.id === 'audit') body = <AuditScreen/>;
  else if (route.id === 'users') body = <UsersScreen/>;
  else if (route.id === 'settings') body = <SettingsScreen/>;
  else if (route.id === 'onboarding') body = <OnboardingScreen onDone={() => setRoute({ id: 'flags' })}/>;
  else if (route.id === 'error') body = <ErrorStatesScreen/>;
  else if (route.id === 'system') body = <DesignSystemScreen/>;
  else body = <PlaceholderScreen title={route.id}/>;

  // Login is full-bleed — replaces the entire shell.
  if (route.id === 'login') {
    return (
      <ToastProvider>
        <LoginScreen onSignedIn={() => setRoute({ id: 'flags' })}/>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="app">
        <TopBar
          project={project}
          activeEnv={activeEnv}
          setActiveEnv={setActiveEnv}
          onSwitchProject={() => setOpenSwitcher(true)}
          onOpenSearch={() => setOpenSearch(true)}
          onShowHelp={() => setOpenHelp(true)}
          onToggleTheme={() => { const t = theme === 'light' ? 'dark' : 'light'; setTheme(t); setTweak('theme', t); }}
          theme={theme}
        />
        <SideNav current={route.id === 'flag-detail' ? 'flags' : route.id} onNav={(id) => setRoute({ id })}/>
        <main className="main" key={route.id + (route.flagKey || '')}>
          {body}
        </main>
      </div>

      <CommandPalette open={openSearch} onClose={() => setOpenSearch(false)} onNav={handleNav}/>
      <HelpPanel open={openHelp} onClose={() => setOpenHelp(false)}/>
      <ProjectSwitcher open={openSwitcher} onClose={() => setOpenSwitcher(false)} current={project} onSelect={setProject}/>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme"/>
        <TweakRadio
          label="Mode" value={tweaks.theme}
          options={['light', 'dark']}
          onChange={(v) => { setTweak('theme', v); setTheme(v); }}
        />
        <TweakColor
          label="Accent" value={tweaks.accent}
          options={[
            ['#0d9488', '#2dd4bf', '#0f766e'],
            ['#4f46e5', '#818cf8', '#4338ca'],
            ['#7c3aed', '#a78bfa', '#6d28d9'],
            ['#e11d48', '#fb7185', '#be123c'],
          ]}
          onChange={(v) => {
            const names = ['teal', 'indigo', 'violet', 'rose'];
            const idx = [
              ['#0d9488', '#2dd4bf', '#0f766e'],
              ['#4f46e5', '#818cf8', '#4338ca'],
              ['#7c3aed', '#a78bfa', '#6d28d9'],
              ['#e11d48', '#fb7185', '#be123c'],
            ].findIndex((p) => p[0] === v[0]);
            setTweak('accent', names[idx] || 'teal');
          }}
        />
        <TweakSection label="Density"/>
        <TweakRadio
          label="Row height" value={tweaks.density}
          options={['compact', 'comfortable']}
          onChange={(v) => setTweak('density', v)}
        />
        <TweakSection label="Demo"/>
        <TweakRadio
          label="Flags list" value={tweaks.flagsLayout}
          options={['redesigned', 'classic']}
          onChange={(v) => setTweak('flagsLayout', v)}
        />
        <TweakToggle
          label="Design notes" value={tweaks.showAnnotations}
          onChange={(v) => setTweak('showAnnotations', v)}
        />
      </TweaksPanel>
    </ToastProvider>
  );
}

function PlaceholderScreen({ title }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
      <div className="card" style={{ padding: 36, textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, textTransform: 'capitalize' }}>{title}</h2>
        <p className="muted" style={{ marginTop: 6 }}>This screen isn't part of the prototype scope.</p>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);
