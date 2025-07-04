import React, { useState, useEffect } from 'react';
import RoomManager from './components/RoomManager';
import ErrorBoundary from './components/ErrorBoundary';

// Main app component
const App = () => {
  // Generate or retrieve persistent peerId
  const [peerId] = useState(() => {
    const storedPeerId = localStorage.getItem('peerId');
    if (storedPeerId) return storedPeerId;
    const newPeerId = Math.random().toString(36).substring(2);
    localStorage.setItem('peerId', newPeerId);
    return newPeerId;
  });

  // Handle cleanup on page unload
  useEffect(() => {
    console.log('[App] Initializing with peerId:', peerId);

    const handleBeforeUnload = async () => {
      console.log('[App] Cleaning up: Peer leaving');
      try {
        await fetch('https://localhost:5000/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ peerId }),
        });
      } catch (error) {
        console.error('[App] Error during leave:', error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      console.log('[App] Cleaning up event listeners');
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [peerId]);

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Proximity Chat</h1>
      <ErrorBoundary>
        <RoomManager key={peerId} peerId={peerId} />
      </ErrorBoundary>
    </div>
  );
};

export default React.memo(App);