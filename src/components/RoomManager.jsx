import React, { useEffect, useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { getCurrentPosition } from '../utils/geolocation';
import { initWebRTC, closeWebRTC, sendMessage, setRemoteDescription, addIceCandidate, getSignalingState } from '../utils/webrtc';
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
      const response = await fetch('https://hello-there-backend-dao6.onrender.com/initiate-group-chat', {
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
      const response = await fetch('https://hello-there-backend-dao6.onrender.com/leave', {
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

      const response = await fetch('https://hello-there-backend-dao6.onrender.com/broadcast', {
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
      const response = await fetch('https://hello-there-backend-dao6.onrender.com/check_location', {
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
        // setPeerList([]);
        // setMessages([]);
        // closeWebRTC();
        // setNotification({ message: 'Removed from room due to distance', visible: true });
      }
    } catch (error) {
      console.error('[RoomManager] Error checking location:', error);
    }
  }, [peerId, location]);

  // Poll signaling messages
  const pollSignalingMessages = useCallback(async () => {
    console.log(`[RoomManager] Polling signaling messages for peer ${peerId}`);
    try {
      const response = await fetch('https://hello-there-backend-dao6.onrender.com/get-signaling-messages', {
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
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .top-bar {
            position: fixed;
            top: 16px;
            right: 16px;
            left: auto;
            display: flex;
            gap: 8px;
            z-index: 1000;
          }

          .btn {
            --color: #00A97F;
            --color2: #202123;
            padding: 0.7em 1.5em;
            background-color: transparent;
            border-radius: 6px;
            border: 0.3px solid var(--color);
            transition: 0.5s;
            position: relative;
            overflow: hidden;
            cursor: pointer;
            z-index: 1;
            font-weight: 700;
            font-size: 14px;
            font-family: 'Inter', sans-serif;
            text-transform: uppercase;
            color: var(--color);
          }

          .btn::after, .btn::before {
            content: '';
            display: block;
            height: 100%;
            width: 100%;
            transform: skew(90deg) translate(-50%, -50%);
            position: absolute;
            inset: 50%;
            left: 25%;
            z-index: -1;
            transition: 0.5s ease-out;
            background-color: var(--color);
          }

          .btn::before {
            top: -50%;
            left: -25%;
            transform: skew(90deg) rotate(180deg) translate(-50%, -50%);
          }

          .btn:hover::before {
            transform: skew(45deg) rotate(180deg) translate(-50%, -50%);
          }

          .btn:hover::after {
            transform: skew(45deg) translate(-50%, -50%);
          }

          .btn:hover {
            color: var(--color2);
          }

          .btn:active {
            filter: brightness(0.7);
            transform: scale(0.98);
          }

          .slice {
            --c1: #202123;
            --c2: #EF4444;
            width: 40px;
            height: 40px;
            padding: 0;
            background-color: transparent;
            border: calc(25px / 8) solid var(--c2);
            border-radius: 0.2em;
            cursor: pointer;
            overflow: hidden;
            position: relative;
            transition: 300ms cubic-bezier(0.83, 0, 0.17, 1);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: 700;
            color: var(--c2);
          }

          .slice::after {
            content: '';
            width: 0;
            height: calc(300% + 1em);
            position: absolute;
            translate: -50% -50%;
            inset: 50%;
            rotate: 30deg;
            background-color: var(--c2);
            transition: 1000ms cubic-bezier(0.83, 0, 0.17, 1);
            color: var(--c1);
          }

          .slice:hover {
            color: var(--c1);
          }

          .slice:hover::after {
            width: calc(120% + 1em);
          }

          .slice:active {
            scale: 0.98;
            filter: brightness(0.9);
          }

          .peer-status {
            font-size: 16px;
            color: #D1D5DB;
            text-align: center;
            margin-top: 30px;
            margin-bottom: 16px;
          }

          .peer-status .connected-word {
            color: #00A97F;
            text-shadow: 0 0 4px rgba(0, 169, 127, 0.6); /* mild glow */
          }

          .cssload-container * {
            box-sizing: border-box;
          }

          .cssload-container {
            margin: 60px auto 0 auto;
            max-width: 524px;
            text-align: center;
          }

          .cssload-container ul li {
            list-style: none;
          }

          .cssload-flex-container {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            justify-content: center;
          }

          .cssload-flex-container li {
            padding: 9.5px;
            height: 94px;
            width: 94px;
            margin: 28px 19px;
            position: relative;
            text-align: center;
          }

          .cssload-loading-center {
            display: inline-block;
            position: absolute;
            background: #FFFFFF;
            height: 28px;
            width: 28px;
            left: 34px;
            top: 34.5px;
            transform: rotate(45deg);
            border-radius: 3px;
            animation: pulse 1.3s ease infinite;
          }

          .cssload-loading {
            display: inline-block;
            position: relative;
            width: 70.5px;
            height: 70.5px;
            margin-top: 3px;
            transform: rotate(45deg);
          }

          .cssload-loading:after, .cssload-loading:before {
            position: absolute;
            content: '';
            height: 9.5px;
            width: 9.5px;
            display: block;
            top: 0;
            background: #10B981;
            border-radius: 3px;
          }

          .cssload-loading:after {
            right: 0;
            animation: square-tr 2.6s ease infinite;
            animation-delay: 0.1625s;
          }

          .cssload-loading:before {
            animation: square-tl 2.6s ease infinite;
            animation-delay: 0.1625s;
          }

          .cssload-loading.cssload-two {
            position: relative;
            top: -75px;
          }

          .cssload-loading.cssload-two:after, .cssload-loading.cssload-two:before {
            bottom: 0;
            top: initial;
          }

          .cssload-loading.cssload-two:after {
            animation: square-br 2.6s ease infinite;
            animation-direction: reverse;
          }

          .cssload-loading.cssload-two:before {
            animation: square-bl 2.6s ease infinite;
            animation-direction: reverse;
          }

          @keyframes square-tl {
            0% { transform: translate(0, 0); }
            25% { transform: translate(0, 58.75px); }
            50% { transform: translate(58.75px, 58.75px); }
            75% { transform: translate(58.75px, 0); }
          }

          @keyframes square-bl {
            0% { transform: translate(0, 0); }
            25% { transform: translate(0, -58.75px); }
            50% { transform: translate(58.75px, -58.75px); }
            75% { transform: translate(58.75px, 0); }
          }

          @keyframes square-tr {
            0% { transform: translate(0, 0); }
            25% { transform: translate(-58.75px, 0); }
            50% { transform: translate(-58.75px, 58.75px); }
            75% { transform: translate(0, 58.75px); }
          }

          @keyframes square-br {
            0% { transform: translate(0, 0); }
            25% { transform: translate(-58.75px, 0); }
            50% { transform: translate(-58.75px, -58.75px); }
            75% { transform: translate(0, -58.75px); }
          }

          @keyframes pulse {
            0%, 100% { transform: scale(1) rotate(45deg); }
            75% { transform: scale(0.25) rotate(45deg); }
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
          className="btn"
          onClick={() => {
            console.log('[RoomManager] Manual broadcast triggered via Connect button');
            broadcast();
          }}
        >
          Connect
        </button>
        <button
          className="slice"
          onClick={handleLeave}
          title="Leave room"
        >X</button>
      </div>
      {peerList.length === 0 ? (
        <div className="cssload-container">
          <ul className="cssload-flex-container">
            <li>
              <span className="cssload-loading cssload-one"></span>
              <span className="cssload-loading cssload-two"></span>
              <span className="cssload-loading-center"></span>
            </li>
          </ul>
        </div>
      ) : (
        <p className="peer-status">
          <span class="connected-word">Connected</span> to {peerList.length} peer(s)
        </p>
      )}
      {notification.visible && (
        <div className="notification visible">
          {notification.message}
        </div>
      )}
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