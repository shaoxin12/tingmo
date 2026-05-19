import React from 'react';
import type { VoiceState } from '../hooks/useVoiceInput';

interface Props {
  state: VoiceState;
}

export const BreathingLight: React.FC<Props> = ({ state }) => {
  if (state === 'idle' || state === 'success') return null;

  return (
    <div className={`breathing-light ${state}`} />
  );
};
