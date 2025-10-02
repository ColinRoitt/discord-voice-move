import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const styles = {
  body: { fontFamily: 'system-ui,Segoe UI,Roboto,Arial', margin: 20, maxWidth: 1000 },
  row: { display: 'flex', flexWrap: 'wrap', gap: 12, margin: '12px 0' },
  col: { flex: '1 1 320px', padding: 12, border: '1px solid #ddd', borderRadius: 12 },
  h2: { margin: '0 0 8px' },
  button: { padding: '10px 14px', borderRadius: 10, border: '1px solid #ccc', cursor: 'pointer' },
  member: { display: 'block', margin: '6px 0' },
  pill: { padding: '4px 8px', border: '1px dashed #bbb', borderRadius: 999 },
  foot: { opacity: .7, marginTop: 8, fontSize: '.9em' },
  input: { padding: 8, border: '1px solid #ccc', borderRadius: 8, minWidth: 220 },
  memberTile: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '14px 16px',
    margin: '8px 0',
    border: '2px solid #ddd',
    borderRadius: 14,
    fontSize: '1.05rem',
    minHeight: 48,                 // ≥44px touch target
    userSelect: 'none',
    touchAction: 'manipulation',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent'
  },
  memberTileOn: {
    borderColor: '#000000',
    background: '#17ff3e'
  }
};

function useInterval(callback, delay) {
  const savedCallback = useRef(callback);
  useEffect(() => { savedCallback.current = callback }, [callback]);
  useEffect(() => {
    if (delay == null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

export default function App(){
  const [channels, setChannels] = useState([]);
  const [status, setStatus] = useState('Ready');
  const [key, setKey] = useState('');
  const [checked, setChecked] = useState(() => new Set());

  const api = useCallback(async (path, opts={}) => {
    if(!key) throw new Error('Enter the x-admin-key');
    const res = await fetch(path, {
      ...opts,
      headers: { 'x-admin-key': key, 'content-type': 'application/json', ...(opts.headers||{}) }
    });
    if(!res.ok){
      const t = await res.text();
      throw new Error(t || res.statusText);
    }
    return res.json();
  }, [key]);

  const refresh = useCallback(async () => {
    try{
      setStatus('Refreshing…');
      const data = await api('/api/voice');
      setChannels(data.channels || []);
      setStatus('Up to date');
    }catch(e){
      setStatus('Error: ' + e.message);
    }
  }, [api]);

  const selectedIds = useMemo(() => Array.from(checked), [checked]);

  const toggle = (id) => setChecked(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const moveSelectedToOther = useCallback(async () => {
    if (selectedIds.length === 0) return alert('Select at least one person.');
    try {
      setStatus('Moving…');
      await api('/api/move-selected-other', { method: 'POST', body: JSON.stringify({ userIds: selectedIds }) });
      setChecked(new Set());
      await refresh();
    } catch (e) {
      setStatus('Error: ' + e.message);
    }
  }, [selectedIds, api, refresh]);

  const allToGeneral = useCallback(async () => {
    setStatus('Gathering…');
    await api('/api/all-to-general', { method: 'POST', body: JSON.stringify({}) });
    setChecked(new Set());
    await refresh();
  }, [api, refresh]);

  useEffect(() => { refresh() }, [refresh]);
  useInterval(() => { refresh().catch(()=>{}) }, 3000);

  return (
    <div style={styles.body}>
      <div style={styles.row}>
        <button style={styles.button} onClick={moveSelectedToOther}>Move Selected → wankers</button>
        <button style={styles.button} onClick={allToGeneral}>Everyone → General</button>
        <button style={styles.button} onClick={refresh}>Refresh</button>
        <input
          style={{ ...styles.input, marginLeft: 8 }}
          placeholder="x-admin-key (required)"
          value={key}
          onChange={e => setKey(e.target.value)}
        />
        <span style={styles.pill}>{status}</span>
      </div>

      <div style={styles.row}>
        {channels.map(c => (
          <div key={c.id} style={styles.col}>
            <h2 style={styles.h2}>{c.name}</h2>
            {(c.members || []).map(m => {
              const isOn = checked.has(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggle(m.id)}
                  style={{ ...styles.memberTile, ...(isOn ? styles.memberTileOn : null) }}
                  role="checkbox"
                  aria-checked={isOn}
                >
                  <span>{m.displayName}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div style={styles.foot}>
        Auto-refresh every 3s. Only two channels are used: <strong>general</strong> and <strong>other_team</strong>.
      </div>
    </div>
  );
}
