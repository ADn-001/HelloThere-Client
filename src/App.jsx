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
        await fetch('https://hello-there-backend-dao6.onrender.com/leave', {
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
    <div className="app-container">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

          .app-container {
            background-color: #202123;
            min-height: 100vh;
            font-family: 'Inter', system-ui, sans-serif;
            color: #D1D5DB;
            padding: 16px;
            display: flex;
            justify-content: center;
          }

          .app-container .content-container {
            width: 100%;
            max-width: 100vw;
          }

          .app-container h1 {
            font-size: 34px;
            font-weight: 700;
            color:rgb(184, 191, 200);
            margin-bottom: 16px;
            margin-top: 0px;
            padding-left:0.5rem;
            display: flex;
          }
        `}
      </style>
      <div className="content-container">
        <h1>Hello-There</h1>
        <ErrorBoundary>
          <RoomManager key={peerId} peerId={peerId} />
        </ErrorBoundary>
      </div>
    </div>
  );
};

export default React.memo(App);