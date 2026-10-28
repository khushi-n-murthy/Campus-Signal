// The player's game state for the whole site: who they are, XP, and which game screen is open.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getJSON, postJSON } from '../lib/api.js';
import { deviceId, load, save } from '../lib/storage.js';

const GameCtx = createContext(null);
export const useGame = () => useContext(GameCtx);

// The recovery code is the phone's private id, shown in groups of 4 so it is easy to copy.
export const recoveryCode = () => (deviceId().match(/.{1,4}/g) || []).join('-');
export const parseRecoveryCode = (text) => String(text || '').toLowerCase().replace(/[^0-9a-f]/g, '');

export function GameProvider({ children }) {
  const [state, setState] = useState({ loading: true, player: null });
  const [screen, setScreen] = useState(null); // null | 'title' | 'create' | 'edit' | 'profile' | 'done'
  const [guest, setGuest] = useState(() => load('cs-guest', false));
  const [reward, setReward] = useState(null);

  const headers = useCallback(() => ({ 'x-device': deviceId() }), []);

  const refresh = useCallback(async () => {
    try {
      const data = await getJSON('/api/game/me', { headers: headers() });
      setState({ loading: false, player: data.player });
    } catch (err) {
      setState({ loading: false, player: null, offline: err.status == null });
    }
  }, [headers]);
  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async ({ nickname, avatar }) => {
    const data = await postJSON('/api/game/profile', { device: deviceId(), nickname, avatar });
    setState({ loading: false, player: data.player });
    return data.player;
  }, []);

  const updateAvatar = useCallback(async (avatar) => {
    const data = await postJSON('/api/game/profile', { avatar }, { method: 'PUT', headers: headers() });
    setState({ loading: false, player: data.player });
    return data.player;
  }, [headers]);

  // Use another phone's code: only works if that explorer exists.
  const restore = useCallback(async (text) => {
    const code = parseRecoveryCode(text);
    if (code.length < 8) throw new Error('That code is too short.');
    const data = await getJSON('/api/game/me', { headers: { 'x-device': code } }).catch(() => null);
    if (!data) throw new Error('No explorer found for that code.');
    save('cs-device', code);
    setState({ loading: false, player: data.player });
    return data.player;
  }, []);

  const skipAsGuest = useCallback(() => { save('cs-guest', true); setGuest(true); setScreen(null); }, []);
  // Only pop up when something was actually earned; always refresh the XP bar.
  const applyReward = useCallback((r) => { if (r && (r.xp > 0 || r.newBadges?.length || r.leveledUp)) setReward(r); refresh(); }, [refresh]);

  const value = useMemo(() => ({
    ...state, screen, setScreen, guest, skipAsGuest, create, updateAvatar, restore, refresh, reward, setReward, applyReward,
  }), [state, screen, guest, skipAsGuest, create, updateAvatar, restore, refresh, reward, applyReward]);
  return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>;
}
