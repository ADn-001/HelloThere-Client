import React, { useEffect, useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { getCurrentPosition } from '../utils/geolocation';
import { initWebRTC, closeWebRTC, sendMessage, setRemoteDescription, addIceCandidate, getSignalingState } from '../utils/webrtc';
import PeerList from './PeerList';
import Chat from './Chat';

// Component to manage room creation, joining, and group chat
const RoomManager = ({ peerId }) => {
  const [error, setError] = useState(null);
  const [location, setLocation] = useState(null);
  const [peerList, setPeerList] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');

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
        setError('Failed to get location: ' + err.message);
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
        setError(`Failed to initiate group chat: ${data.error}`);
        if (data.error === 'Peer not found in any room' || data.error === 'Room not found') {
          setPeerList([]);
          setMessages([]);
          closeWebRTC();
        }
      }
    } catch (error) {
      console.error('[RoomManager] Error initiating group chat:', error);
      setError('Failed to initiate group chat');
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
        setError(null);
        if (data.peerList && data.peerList.length > 0) {
          setPeerList(data.peerList);
          initiateGroupChat(data.peerList);
        } else {
          setPeerList([]);
        }
      } else {
        setError(`Unexpected broadcast response: ${data.status}`);
        console.log(`[RoomManager] Unexpected response data:`, data);
      }
    } catch (error) {
      console.error('[RoomManager] Broadcast error:', error);
      let errorMessage = 'Broadcast failed: Unknown error';
      if (error.name === 'AbortError') {
        errorMessage = 'Broadcast failed: Request timed out. Check server availability.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Failed to connect to server. Please ensure the server is running and the certificate is trusted.';
      } else {
        errorMessage = `Broadcast failed: ${error.message}`;
      }
      setError(errorMessage);
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
        setError('Removed from room due to distance');
        closeWebRTC();
      }
    } catch (error) {
      console.error('[RoomManager] Error checking location:', error);
      setError('Failed to check location');
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
            setError(`Failed to connect to peer ${msg.sender}`);
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
            setError(`Failed to process offer from ${msg.sender}`);
          }
        } else if (msg.type === 'answer') {
          console.log(`[RoomManager] Received answer from ${msg.sender}, signaling state: ${getSignalingState(msg.sender)}`);
          try {
            await setRemoteDescription(msg.sender, msg.data);
            console.log(`[RoomManager] Processed answer from ${msg.sender}`);
          } catch (error) {
            console.error(`[RoomManager] Failed to process answer from ${msg.sender}:`, error);
            setError(`Failed to process answer from ${msg.sender}`);
          }
        } else if (msg.type === 'ice-candidate') {
          console.log(`[RoomManager] Received ICE candidate from ${msg.sender}`);
          try {
            await addIceCandidate(msg.sender, msg.data);
            console.log(`[RoomManager] Processed ICE candidate from ${msg.sender}`);
          } catch (error) {
            console.error(`[RoomManager] Failed to process ICE candidate from ${msg.sender}:`, error);
            setError(`Failed to process ICE candidate from ${msg.sender}`);
          }
        }
      }
    } catch (error) {
      console.error('[RoomManager] Error polling signaling messages:', error);
      setError('Failed to poll signaling messages');
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
    // Delay initial check to ensure geolocation is available
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
    <div className="p-4">
      <p className="text-lg">Group Chat</p>
      {error && <p className="text-red-500">{error}</p>}
      <PeerList peerList={peerList} />
      <Chat
        messages={messages}
        inputText={inputText}
        setInputText={setInputText}
        handleSendMessage={handleSendMessage}
      />
      <button
        className="bg-blue-500 text-white px-4 py-2 rounded mt-2"
        onClick={() => {
          console.log('[RoomManager] Manual broadcast triggered via Retry button');
          broadcast();
        }}
      >
        Retry
      </button>
    </div>
  );
};

RoomManager.propTypes = {
  peerId: PropTypes.string.isRequired,
};

export default React.memo(RoomManager);