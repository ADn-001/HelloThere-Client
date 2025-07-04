import React from 'react';
import PropTypes from 'prop-types';

// Component to display list of peers
const PeerList = ({ peerList }) => {
  console.log('[PeerList] Rendering with peerList:', peerList);

  return (
    <div className="mt-4">
      <h2 className="text-xl font-semibold mb-2">Nearby Peers</h2>
      {peerList.length === 0 ? (
        <p className="text-gray-500">No peers found nearby</p>
      ) : (
        <div className="space-y-2">
          <p className="text-gray-700">Connected peers: {peerList.join(', ')}</p>
        </div>
      )}
    </div>
  );
};

PeerList.propTypes = {
  peerList: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default React.memo(PeerList);