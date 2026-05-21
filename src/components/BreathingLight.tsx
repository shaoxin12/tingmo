import React from 'react';
import type { VoiceState } from '../hooks/useVoiceInput';

interface Props {
  state: VoiceState;
}

export const BreathingLight: React.FC<Props> = ({ state }) => {
  if (state === 'idle' || state === 'success') return null;

  // 'refining' uses the same spinning ring as 'recognizing'
  const displayState = state === 'refining' ? 'recognizing' : state;

  return (
    <div className={`breathing-light ${displayState}`} />
  );
};
