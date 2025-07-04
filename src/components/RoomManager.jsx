import React, { useEffect, useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { getCurrentPosition } from '../utils/geolocation';
import { initWebRTC, closeWebRTC, sendMessage, setRemoteDescription, addIceCandidate, getSignalingState } from '../utils/webrtc';
import PeerList from './PeerList';
import Chat from './Chat';

// Component to manage room creation, joining, and group chat
const RoomManager = ({ peerId }) => {
  const [location, setLocation] = useState(null);
  const [peerList, setPeerList] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [notification, setNotification] = useState({ message: '', visible: false });

  // Get geolocation on mount
  useEffect(() => {
    console.log(`[RoomManager] Fetching geolocation for peer ${peerId}`);
    getCurrentPosition()
      .then(position => {
        console.log(`[RoomManager] Geolocation obtained: lat=${position.coords.latitude}, lon=${position.coords.longitude}`);
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      })
      .catch(err => {
        console.error('[RoomManager] Geolocation error:', err);
      });
  }, [peerId]);

  // Handle received messages
  const onMessageCallback = useCallback((senderPeerId, message) => {
    console.log(`[RoomManager] Received message from ${senderPeerId}: ${message}`);
    setMessages(prev => [...prev, {
      id: prev.length + 1,
      text: message,
      sender: senderPeerId
    }]);
  }, []);

  // Initiate group chat to update active chats and peer list
  const initiateGroupChat = useCallback(async (peers) => {
    console.log(`[RoomManager] Initiating group chat with peers: ${peers}`);
    try {
      const response = await fetch('https://localhost:5000/initiate-group-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId }),
      });
      const data = await response.json();
      if (response.ok) {
        console.log(`[RoomManager] Group chat peers: ${data.peers}`);
        // WebRTC initialization handled by peer-joined messages
      } else {
        console.error('[RoomManager] Error initiating group chat:', data.error);
        if (data.error === 'Peer not found in any room' || data.error === 'Room not found') {
          setPeerList([]);
          setMessages([]);
          closeWebRTC();
        }
      }
    } catch (error) {
      console.error('[RoomManager] Error initiating group chat:', error);
    }
  }, [peerId]);

  // Handle leave action
  const handleLeave = useCallback(async () => {
    console.log('[RoomManager] Leave button clicked, sending /leave request');
    try {
      const response = await fetch('https://localhost:5000/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId }),
      });
      if (response.ok) {
        console.log('[RoomManager] Successfully left room');
        closeWebRTC();
        setPeerList([]);
        setMessages([]);
        setNotification({ message: 'Left room', visible: true });
      } else {
        console.error('[RoomManager] Error leaving room:', await response.json());
      }
    } catch (error) {
      console.error('[RoomManager] Error sending /leave request:', error);
    }
  }, [peerId]);

  // Memoized broadcast function
  const broadcast = useCallback(async (attempt = 1) => {
    if (!location) {
      console.log('[RoomManager] No location available, skipping broadcast');
      return;
    }
    console.log(`[RoomManager] Starting broadcast for peer ${peerId}, attempt ${attempt}`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://localhost:5000/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostLatitude: location.latitude,
          hostLongitude: location.longitude,
          timestamp: new Date().toISOString(),
          peerId,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await response.json();
      console.log(`[RoomManager] Broadcast response: ${data.status}, peerList: ${data.peerList}`);
      if (data.status === 'created' || data.status === 'joined') {
        setNotification({ message: 'Room joined', visible: true });
        if (data.peerList && data.peerList.length > 0) {
          setPeerList(data.peerList);
          initiateGroupChat(data.peerList);
        } else {
          setPeerList([]);
        }
      } else {
        console.log(`[RoomManager] Unexpected response data:`, data);
      }
    } catch (error) {
      console.error('[RoomManager] Broadcast error:', error);
      if (attempt <= 3) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[RoomManager] Retrying broadcast in ${delay}ms (attempt ${attempt + 1})`);
        setTimeout(() => broadcast(attempt + 1), delay);
      } else {
        console.log('[RoomManager] Max retry attempts reached');
      }
    }
  }, [peerId, location, initiateGroupChat]);

  // Memoized check location function
  const checkLocation = useCallback(async () => {
    if (!location) {
      console.log('[RoomManager] No location available, skipping location check');
      return;
    }
    console.log(`[RoomManager] Checking location for peer ${peerId}`);
    try {
      const response = await fetch('https://localhost:5000/check_location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          peerId,
        }),
      });
      const data = await response.json();
      console.log(`[RoomManager] Check location response: ${data.status}`);
      if (data.status === 'removed') {
        setPeerList([]);
        setMessages([]);
        closeWebRTC();
        setNotification({ message: 'Removed from room due to distance', visible: true });
      }
    } catch (error) {
      console.error('[RoomManager] Error checking location:', error);
    }
  }, [peerId, location]);

  // Poll signaling messages
  const pollSignalingMessages = useCallback(async () => {
    console.log(`[RoomManager] Polling signaling messages for peer ${peerId}`);
    try {
      const response = await fetch('https://localhost:5000/get-signaling-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId }),
      });
      const data = await response.json();
      console.log(`[RoomManager] Received ${data.messages.length} signaling messages`);
      for (const msg of data.messages) {
        if (msg.type === 'peer-joined') {
          console.log(`[RoomManager] Peer ${msg.sender} joined`);
          setPeerList(prev => prev.includes(msg.sender) ? prev : [...prev, msg.sender]);
          try {
            await initWebRTC(peerId, msg.sender, onMessageCallback);
            console.log(`[RoomManager] WebRTC initialized with ${msg.sender}`);
          } catch (error) {
            console.error(`[RoomManager] Failed to initialize WebRTC with ${msg.sender}:`, error);
          }
        } else if (msg.type === 'peer-left') {
          console.log(`[RoomManager] Peer ${msg.sender} left, closing WebRTC`);
          closeWebRTC(msg.sender);
          setPeerList(prev => prev.filter(p => p !== msg.sender));
          setMessages(prev => prev.filter(m => m.sender !== msg.sender));
        } else if (msg.type === 'offer') {
          console.log(`[RoomManager] Received offer from ${msg.sender}, processing`);
          try {
            await initWebRTC(peerId, msg.sender, onMessageCallback, msg.data);
            console.log(`[RoomManager] Processed offer from ${msg.sender}`);
          } catch (error) {
            console.error(`[RoomManager] Failed to process offer from ${msg.sender}:`, error);
          }
        } else if (msg.type === 'answer') {
          console.log(`[RoomManager] Received answer from ${msg.sender}, signaling state: ${getSignalingState(msg.sender)}`);
          try {
            await setRemoteDescription(msg.sender, msg.data);
            console.log(`[RoomManager] Processed answer from ${msg.sender}`);
          } catch (error) {
            console.error(`[RoomManager] Failed to process answer from ${msg.sender}:`, error);
          }
        } else if (msg.type === 'ice-candidate') {
          console.log(`[RoomManager] Received ICE candidate from ${msg.sender}`);
          try {
            await addIceCandidate(msg.sender, msg.data);
            console.log(`[RoomManager] Processed ICE candidate from ${msg.sender}`);
          } catch (error) {
            console.error(`[RoomManager] Failed to process ICE candidate from ${msg.sender}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('[RoomManager] Error polling signaling messages:', error);
    }
  }, [peerId, onMessageCallback]);

  // Send message to all connected peers
  const handleSendMessage = useCallback(() => {
    if (inputText.trim()) {
      console.log(`[RoomManager] Sending message to all peers: ${inputText}`);
      sendMessage(inputText);
      setMessages(prev => [...prev, {
        id: prev.length + 1,
        text: inputText,
        sender: peerId
      }]);
      setInputText('');
    }
  }, [inputText, peerId]);

  // Handle notification auto-hide
  useEffect(() => {
    if (notification.visible) {
      const timer = setTimeout(() => {
        setNotification(prev => ({ ...prev, visible: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Handle broadcasting
  useEffect(() => {
    console.log(`[RoomManager] Broadcast useEffect triggered for peer ${peerId}`);
    let broadcastInterval;
    if (process.env.NODE_ENV !== 'development' || !module.hot) {
      broadcast();
      broadcastInterval = setInterval(() => {
        console.log('[RoomManager] Periodic broadcast triggered');
        broadcast();
      }, 30 * 1000);
    }
    return () => {
      console.log('[RoomManager] Cleaning up broadcast interval');
      clearInterval(broadcastInterval);
    };
  }, [broadcast, peerId]);

  // Handle location checking with initial delay
  useEffect(() => {
    console.log(`[RoomManager] Location check useEffect triggered for peer ${peerId}`);
    let locationCheckInterval;
    setTimeout(() => {
      checkLocation();
      locationCheckInterval = setInterval(() => {
        console.log('[RoomManager] Checking location');
        checkLocation();
      }, 10 * 1000);
    }, 2000);
    return () => {
      console.log('[RoomManager] Cleaning up location check interval');
      clearInterval(locationCheckInterval);
    };
  }, [checkLocation, peerId]);

  // Handle signaling messages
  useEffect(() => {
    console.log(`[RoomManager] Signaling messages polling useEffect triggered for peer ${peerId}`);
    let signalingInterval;
    pollSignalingMessages();
    signalingInterval = setInterval(() => {
      console.log('[RoomManager] Polling signaling messages');
      pollSignalingMessages();
    }, 2000);
    return () => {
      console.log('[RoomManager] Cleaning up signaling interval');
      clearInterval(signalingInterval);
    };
  }, [pollSignalingMessages, peerId]);

  return (
    <div className="room-manager">
      <style>
        {`
          .room-manager {
            max-width: 600px;
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .top-bar {
            position: fixed;
            top: 16px;
            left: 16px;
            display: flex;
            gap: 8px;
            z-index: 1000;
          }

          .connect-button {
            background-color: #10B981;
            color: #FFFFFF;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            border: none;
            cursor: pointer;
            transition: background-color 0.2s;
          }

          .connect-button:hover {
            background-color: #059669;
          }

          .leave-button {
            background-color: #EF4444;
            color: #FFFFFF;
            width: 40px;
            height: 40px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            transition: background-color 0.2s;
          }

          .leave-button:hover {
            background-color: #DC2626;
          }

          .peer-status {
            font-size: 14px;
            color: #D1D5DB;
            text-align: center;
            margin-top: 60px;
          }

          .peer-status.no-peers {
            color: #6B7280;
          }

          .notification {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: #343541;
            color: #FFFFFF;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            opacity: 0;
            transition: opacity 0.3s ease-in-out;
            z-index: 2000;
          }

          .notification.visible {
            opacity: 1;
          }
        `}
      </style>
      <div className="top-bar">
        <button
          className="connect-button"
          onClick={() => {
            console.log('[RoomManager] Manual broadcast triggered via Connect button');
            broadcast();
          }}
        >
          Connect
        </button>
        <button
          className="leave-button"
          onClick={handleLeave}
          title="Leave room"
        >
          ✕
        </button>
      </div>
      <p className={`peer-status ${peerList.length === 0 ? 'no-peers' : ''}`}>
        {peerList.length > 0 ? `Connected to ${peerList.length} peer(s)` : 'No peers connected'}
      </p>
      {notification.visible && (
        <div className="notification visible">
          {notification.message}
        </div>
      )}
      <PeerList peerList={peerList} />
      <Chat
        messages={messages}
        inputText={inputText}
        setInputText={setInputText}
        handleSendMessage={handleSendMessage}
        peerId={peerId}
      />
    </div>
  );
};

RoomManager.propTypes = {
  peerId: PropTypes.string.isRequired,
};

export default React.memo(RoomManager);