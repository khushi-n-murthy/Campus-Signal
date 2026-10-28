// Mounts whichever game dialog is open. Placed once, above the router pages.
import { useGame } from './GameContext.jsx';
import Onboarding from './Onboarding.jsx';
import ProfileCard from './ProfileCard.jsx';
import RewardPop from './RewardPop.jsx';

export default function GameLayer() {
  const g = useGame();
  if (!g) return null;
  return (
    <>
      {(g.screen === 'title' || g.screen === 'create' || g.screen === 'edit') && <Onboarding key={g.screen} />}
      {g.screen === 'profile' && g.player && <ProfileCard />}
      <RewardPop />
    </>
  );
}
