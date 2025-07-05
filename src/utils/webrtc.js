const connections = {}; // { [targetPeerId]: { peerConnection: RTCPeerConnection, dataChannel: RTCDataChannel, role: 'offering'|'answering', pendingIceCandidates: Array } }

/**
 * Initialize WebRTC for group chat
 * @param {string} peerId - Current peer's ID
 * @param {string} targetPeerId - Target peer's ID
 * @param {Function} onMessageCallback - Callback for received messages
 * @param {Object} [offer] - Optional offer to process
 */
export async function initWebRTC(peerId, targetPeerId, onMessageCallback, offer = null) {
  console.log(`[Client] Initializing WebRTC for peer ${peerId} with ${targetPeerId}, offer provided: ${!!offer}`);

  // If connection exists and we're processing an offer
  if (connections[targetPeerId] && offer) {
    console.log(`[Client] Processing offer for existing connection with ${targetPeerId}, current role: ${connections[targetPeerId].role}`);
    if (connections[targetPeerId].role === 'offering') {
      console.log(`[Client] Ignoring offer from ${targetPeerId} as we are already offering`);
      return;
    }
    try {
      const { peerConnection } = connections[targetPeerId];
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log(`[Client] Set remote description for ${targetPeerId}`);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log(`[Client] Sending answer to ${targetPeerId}:`, answer);
      await sendSignalingMessage(peerId, targetPeerId, { type: 'answer', answer });
      // Process pending ICE candidates
      if (connections[targetPeerId].pendingIceCandidates) {
        for (const candidate of connections[targetPeerId].pendingIceCandidates) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log(`[Client] Added pending ICE candidate for ${targetPeerId}:`, candidate);
        }
        connections[targetPeerId].pendingIceCandidates = [];
      }
    } catch (error) {
      console.error(`[Client] Error processing offer for ${targetPeerId}:`, error);
      closeWebRTC(targetPeerId);
      throw error;
    }
    return;
  }

  // Skip if connection already exists and no offer is provided
  if (connections[targetPeerId]) {
    console.log(`[Client] Connection with ${targetPeerId} already exists, role: ${connections[targetPeerId].role}`);
    return;
  }

  const configuration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  };
  const peerConnection = new RTCPeerConnection(configuration);
  const dataChannel = peerConnection.createDataChannel('chat', { negotiated: true, id: 0 });

  // Track role as 'offering'
  connections[targetPeerId] = { peerConnection, dataChannel, role: 'offering', pendingIceCandidates: [] };

  console.log(`[Client] Created new connection with ${targetPeerId} as offerer`);

  dataChannel.onopen = () => {
    console.log(`[Client] Data channel opened with peer ${targetPeerId}`);
  };
  dataChannel.onmessage = (event) => {
    console.log(`[Client] Received message from peer ${targetPeerId}: ${event.data}`);
    onMessageCallback(targetPeerId, event.data);
  };
  dataChannel.onclose = () => {
    console.log(`[Client] Data channel closed with peer ${targetPeerId}`);
  };
  dataChannel.onerror = (error) => {
    console.error(`[Client] Data channel error with peer ${targetPeerId}:`, error);
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log(`[Client] Sending ICE candidate to peer ${targetPeerId}:`, event.candidate);
      sendSignalingMessage(peerId, targetPeerId, { type: 'ice-candidate', candidate: event.candidate });
    }
  };

  peerConnection.onconnectionstatechange = () => {
    console.log(`[Client] Connection state with ${targetPeerId}: ${peerConnection.connectionState}`);
    if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
      console.log(`[Client] Closing connection with peer ${targetPeerId} due to ${peerConnection.connectionState}`);
      closeWebRTC(targetPeerId);
    }
  };

  try {
    if (offer) {
      console.log(`[Client] Processing offer for ${targetPeerId}:`, offer);
      connections[targetPeerId].role = 'answering';
      console.log(`[Client] Set role to answering for ${targetPeerId}`);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log(`[Client] Set remote description for ${targetPeerId}`);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log(`[Client] Sending answer to ${targetPeerId}:`, answer);
      await sendSignalingMessage(peerId, targetPeerId, { type: 'answer', answer });
    } else {
      console.log(`[Client] Creating offer for ${targetPeerId}`);
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      console.log(`[Client] Sending offer to ${targetPeerId}:`, offer);
      await sendSignalingMessage(peerId, targetPeerId, { type: 'offer', offer });
    }
  } catch (error) {
    console.error(`[Client] Error in WebRTC setup for ${targetPeerId}:`, error);
    closeWebRTC(targetPeerId);
    throw error;
  }
}

/**
 * Get the signaling state for a peer
 * @param {string} targetPeerId - Target peer's ID
 * @returns {string} - The signaling state or 'none' if no connection exists
 */
export function getSignalingState(targetPeerId) {
  if (connections[targetPeerId] && connections[targetPeerId].peerConnection) {
    return connections[targetPeerId].peerConnection.signalingState;
  }
  return 'none';
}

/**
 * Set remote description for a peer
 */
export async function setRemoteDescription(targetPeerId, description) {
  if (connections[targetPeerId] && connections[targetPeerId].peerConnection) {
    const peerConnection = connections[targetPeerId].peerConnection;
    try {
      console.log(`[Client] Setting remote description for ${targetPeerId}, current signaling state: ${peerConnection.signalingState}`);
      if (description.type === 'answer' && peerConnection.signalingState === 'stable') {
        console.log(`[Client] InvalidStateError detected for ${targetPeerId}, resetting connection`);
        closeWebRTC(targetPeerId);
        throw new Error('Connection reset due to InvalidStateError');
      }
      await peerConnection.setRemoteDescription(new RTCSessionDescription(description));
      console.log(`[Client] Set remote description for ${targetPeerId}:`, description);
      // Process pending ICE candidates
      if (connections[targetPeerId].pendingIceCandidates) {
        for (const candidate of connections[targetPeerId].pendingIceCandidates) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log(`[Client] Added pending ICE candidate for ${targetPeerId}:`, candidate);
        }
        connections[targetPeerId].pendingIceCandidates = [];
      }
    } catch (error) {
      console.error(`[Client] Error setting remote description for ${targetPeerId}:`, error);
      throw error;
    }
  } else {
    console.error(`[Client] No connection found for ${targetPeerId}`);
  }
}

/**
 * Add ICE candidate for a peer
 */
export async function addIceCandidate(targetPeerId, candidate) {
  if (connections[targetPeerId] && connections[targetPeerId].peerConnection) {
    const peerConnection = connections[targetPeerId].peerConnection;
    if (peerConnection.remoteDescription) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log(`[Client] Added ICE candidate for ${targetPeerId}:`, candidate);
      } catch (error) {
        console.error(`[Client] Error adding ICE candidate for ${targetPeerId}:`, error);
        throw error;
      }
    } else {
      console.log(`[Client] Remote description not set for ${targetPeerId}, queuing ICE candidate`);
      connections[targetPeerId].pendingIceCandidates.push(candidate);
    }
  } else {
    console.error(`[Client] No connection found for ${targetPeerId}`);
  }
}

/**
 * Send a signaling message to the server
 */
async function sendSignalingMessage(peerId, targetPeerId, message) {
  try {
    const endpoint = message.type === 'offer' ? '/offer' : 
                    message.type === 'answer' ? '/answer' : '/ice-candidate';
    const body = message.type === 'offer' ? { peerId, targetPeerIds: [targetPeerId], offer: message.offer } :
                 message.type === 'answer' ? { peerId, targetPeerId, answer: message.answer } :
                 { peerId, targetPeerId, candidate: message.candidate };
    console.log(`[Client] Sending ${message.type} to ${targetPeerId}:`, body);
    const response = await fetch(`https://hello-there-backend-dao6.onrender.com${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    console.log(`[Client] Sent ${message.type} to ${targetPeerId}:`, data);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
  } catch (error) {
    console.error(`[Client] Error sending ${message.type} to ${targetPeerId}:`, error);
    throw error;
  }
}

/**
 * Send a message to all connected peers
 */
export function sendMessage(message) {
  Object.values(connections).forEach(({ dataChannel }) => {
    if (dataChannel && dataChannel.readyState === 'open') {
      console.log('[Client] Sending message:', message);
      dataChannel.send(message);
    } else {
      console.log('[Client] Data channel not open, state:', dataChannel ? dataChannel.readyState : 'null');
    }
  });
}

/**
 * Close WebRTC connection for a specific peer or all peers
 */
export function closeWebRTC(targetPeerId = null) {
  if (targetPeerId) {
    if (connections[targetPeerId]) {
      console.log(`[Client] Closing WebRTC connection with ${targetPeerId}`);
      if (connections[targetPeerId].dataChannel) {
        connections[targetPeerId].dataChannel.close();
      }
      if (connections[targetPeerId].peerConnection) {
        connections[targetPeerId].peerConnection.close();
      }
      delete connections[targetPeerId];
    }
  } else {
    console.log('[Client] Closing all WebRTC connections');
    Object.keys(connections).forEach(peerId => {
      if (connections[peerId].dataChannel) {
        connections[peerId].dataChannel.close();
      }
      if (connections[peerId].peerConnection) {
        connections[peerId].peerConnection.close();
      }
      delete connections[peerId];
    });
  }
}