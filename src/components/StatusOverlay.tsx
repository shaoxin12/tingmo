import React from 'react';

interface Props {
  text: string;
}

export const StatusOverlay: React.FC<Props> = ({ text }) => {
  return (
    <div className="status-overlay">
      <span>{text}</span>
    </div>
  );
};
